import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '30d';
const WELCOME_CREDITS = Number(process.env.WELCOME_CREDITS) || 50;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: '/',
};

const TOKEN_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

function generateState() {
  return randomBytes(32).toString('hex');
}

function generateCodeVerifier() {
  return randomBytes(64).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function sanitizeUser(row) {
  return {
    id: row.id, email: row.email, name: row.name, role: row.role,
    credits: row.credits, free_wan: row.free_wan ?? 0,
    free_veo: row.free_veo ?? 0, free_image: row.free_image ?? 0,
    created_at: row.created_at,
  };
}

async function findOrCreateSSOUser(provider, providerId, email, name) {
  const byProvider = await pool.query(
    `SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2 LIMIT 1`,
    [provider, providerId],
  );
  if (byProvider.rows.length > 0) {
    return { user: byProvider.rows[0], isNew: false };
  }

  if (email) {
    const byEmail = await pool.query(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()],
    );
    if (byEmail.rows.length > 0) {
      await pool.query(
        `UPDATE users SET auth_provider = $1, provider_id = $2, name = COALESCE(name, $3) WHERE id = $4`,
        [provider, providerId, name, byEmail.rows[0].id],
      );
      return { user: { ...byEmail.rows[0], auth_provider: provider, provider_id: providerId }, isNew: false };
    }
  }

  const result = await pool.query(
    `INSERT INTO users (email, name, auth_provider, provider_id, credits)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email?.toLowerCase() || null, name, provider, providerId, WELCOME_CREDITS],
  );
  return { user: result.rows[0], isNew: true };
}

function issueToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

// ── Yandex ID ──

export function yandexInit(req, res) {
  const state = generateState();
  res.cookie('oauth_state', state, COOKIE_OPTS);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.YANDEX_CLIENT_ID,
    redirect_uri: process.env.YANDEX_CALLBACK_URL,
    state,
  });
  res.redirect(`https://oauth.yandex.com/authorize?${params}`);
}

export async function yandexCallback(req, res) {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.oauth_state;
    res.clearCookie('oauth_state', { path: '/' });

    if (!code || !state || state !== savedState) {
      return res.redirect('/login?error=csrf');
    }

    const tokenRes = await fetch('https://oauth.yandex.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_CLIENT_ID,
        client_secret: process.env.YANDEX_CLIENT_SECRET,
      }),
    });
    if (!tokenRes.ok) {
      console.error('[sso:yandex] token error:', await tokenRes.text());
      return res.redirect('/login?error=token');
    }
    const tokenData = await tokenRes.json();

    const profileRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      console.error('[sso:yandex] profile error:', await profileRes.text());
      return res.redirect('/login?error=profile');
    }
    const profile = await profileRes.json();

    const email = profile.default_email || profile.emails?.[0];
    const name = profile.display_name || profile.real_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;

    const { user } = await findOrCreateSSOUser('yandex', String(profile.id), email, name);
    const token = issueToken(user);

    console.log(`[sso:yandex] Login: user=${user.id} email=${user.email} provider_id=${profile.id}`);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[sso:yandex] callback error:', err);
    res.redirect('/login?error=server');
  }
}

// ── VK ID (OAuth 2.1 + PKCE) ──

export function vkInit(req, res) {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  res.cookie('oauth_state', state, COOKIE_OPTS);
  res.cookie('pkce_verifier', codeVerifier, COOKIE_OPTS);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.VK_CLIENT_ID,
    redirect_uri: process.env.VK_CALLBACK_URL,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'email',
  });
  res.redirect(`https://id.vk.com/authorize?${params}`);
}

export async function vkCallback(req, res) {
  try {
    const { code, state, device_id } = req.query;
    const savedState = req.cookies?.oauth_state;
    const codeVerifier = req.cookies?.pkce_verifier;
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('pkce_verifier', { path: '/' });

    if (!code || !state || state !== savedState || !codeVerifier) {
      return res.redirect('/login?error=csrf');
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: process.env.VK_CLIENT_ID,
      redirect_uri: process.env.VK_CALLBACK_URL,
      state,
    });
    if (device_id) tokenBody.set('device_id', device_id);

    const tokenRes = await fetch('https://id.vk.com/oauth2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    if (!tokenRes.ok) {
      console.error('[sso:vk] token error:', await tokenRes.text());
      return res.redirect('/login?error=token');
    }
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('[sso:vk] token error response:', tokenData);
      return res.redirect('/login?error=token');
    }

    const profileRes = await fetch('https://id.vk.com/oauth2/user_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.VK_CLIENT_ID,
        access_token: tokenData.access_token,
      }),
    });
    if (!profileRes.ok) {
      console.error('[sso:vk] profile error:', await profileRes.text());
      return res.redirect('/login?error=profile');
    }
    const profileData = await profileRes.json();
    const profile = profileData.user || profileData;

    if (profileData.error) {
      console.error('[sso:vk] profile error response:', profileData);
      return res.redirect('/login?error=profile');
    }

    const userId = String(profile.user_id || profile.id);
    const email = profile.email || tokenData.email || null;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;

    const { user } = await findOrCreateSSOUser('vk', userId, email, name);
    const token = issueToken(user);

    console.log(`[sso:vk] Login: user=${user.id} email=${user.email} provider_id=${userId}`);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[sso:vk] callback error:', err);
    res.redirect('/login?error=server');
  }
}
