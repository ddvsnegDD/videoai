import pg from 'pg';
const { Pool } = pg;

// SSL: включаем только для удалённых БД (Railway и т.п.),
// для локального PostgreSQL на VPS — не нужен
const dbUrl = process.env.DATABASE_URL || '';
const isLocalDB = /localhost|127\.0\.0\.1|\/var\/run/.test(dbUrl);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' && !isLocalDB
    ? { rejectUnauthorized: false }
    : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      role VARCHAR(20) DEFAULT 'user',
      credits INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_wan INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_veo INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_image INTEGER DEFAULT 1;

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      template_id VARCHAR(50),
      brief JSONB NOT NULL,
      result_url TEXT,
      status VARCHAR(20) DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      input JSONB NOT NULL,
      output JSONB,
      error TEXT,
      cost_credits INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Sprint A fixes: seed, dedup, reconciler
    ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS seed BIGINT;
    ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS fal_request_id TEXT;
    ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ;
    ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
    ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;

    -- Sprint 6: payments
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      package_id TEXT,
      label TEXT,
      expected_amount NUMERIC,
      paid_amount NUMERIC,
      operation_id TEXT,
      credits_granted INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS package_id TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS label TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS expected_amount NUMERIC;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS operation_id TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS credits_granted INTEGER;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

    -- YooKassa migration: new columns on payments
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'yoomoney';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS yookassa_payment_id TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_status TEXT DEFAULT 'not_needed';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotence_key TEXT;

    -- Pending receipts queue (self-employed manual tracking)
    CREATE TABLE IF NOT EXISTS pending_receipts (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER REFERENCES payments(id),
      user_email TEXT,
      amount NUMERIC NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);

  // Partial unique index for dedup (only active jobs)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_job
    ON generation_jobs (idempotency_key)
    WHERE status IN ('pending','running') AND idempotency_key IS NOT NULL
  `).catch(() => {});

  // Unique index on operation_id to prevent double-crediting (YooMoney legacy)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_operation_id
    ON payments (operation_id)
    WHERE operation_id IS NOT NULL
  `).catch(() => {});

  // Unique index on yookassa_payment_id to prevent double-crediting (YooKassa)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_yookassa_payment_id
    ON payments (yookassa_payment_id)
    WHERE yookassa_payment_id IS NOT NULL
  `).catch(() => {});

  // Cleanup: drop Phase 1 group entities (safe — columns/table may not exist)
  await pool.query(`DROP TABLE IF EXISTS video_groups`).catch(() => {});
  await pool.query(`ALTER TABLE generation_jobs DROP COLUMN IF EXISTS group_id`).catch(() => {});
  await pool.query(`ALTER TABLE generation_jobs DROP COLUMN IF EXISTS segment_index`).catch(() => {});
  await pool.query(`ALTER TABLE generation_jobs DROP COLUMN IF EXISTS segment_duration`).catch(() => {});

  // SSO: auth_provider + provider_id on users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20)`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`).catch(() => {});
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider
    ON users (auth_provider, provider_id)
    WHERE auth_provider IS NOT NULL AND provider_id IS NOT NULL
  `).catch(() => {});

  // Profile: avatar + consent
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version TEXT`).catch(() => {});

  // B1: folders for clip library
  await pool.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)`).catch(() => {});
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id)`).catch(() => {});

  // B2: video assemblies
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assemblies (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'queued',
      canvas VARCHAR(10) NOT NULL,
      clip_ids JSONB NOT NULL,
      audio_key TEXT,
      output_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_assemblies_user_status ON assemblies(user_id, status)`).catch(() => {});

  console.log('DB tables ready');
}

export default pool;
