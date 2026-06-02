import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
  `);

  // Partial unique index for dedup (only active jobs)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_job
    ON generation_jobs (idempotency_key)
    WHERE status IN ('pending','running') AND idempotency_key IS NOT NULL
  `).catch(() => {});

  // Unique index on operation_id to prevent double-crediting
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_operation_id
    ON payments (operation_id)
    WHERE operation_id IS NOT NULL
  `).catch(() => {});

  console.log('DB tables ready');
}

export default pool;
