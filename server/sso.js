import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '30d';
const WELCOME_CREDITS = Number(process.env.WELCOME_CREDITS) || 50;
const FREE_WAN_SSO = parseInt(process.env.FREE_WAN_SSO ?? '1', 10);
const FREE_VEO_SSO = parseInt(process.env.FREE_VEO_SSO ?? '1', 10);
const FREE_IMAGE_SSO = parseInt(process.env.FREE_IMAGE_SSO ?? '1', 10);
const CONSENT_VERSION = '2026-06-08';

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
    avatar_url: row.avatar_url || null,
    auth_provider: row.auth_provider || null,
    created_at: row.created_at,
  };
}

async function findOrCreateSSOUser(provider, providerId, email, name, avatarUrl, withConsent) {
  const byProvider = await pool.query(
    `SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2 LIMIT 1`,
    [provider, providerId],
  );
  if (byProvider.rows.length > 0) {
    const u = byProvider.rows[0];
    await pool.query(
      `UPDATE users SET name = COALESCE(name, $1), avatar_url = COALESCE(avatar_url, $2) WHERE id = $3`,
      [name, avatarUrl, u.id],
    );
    return { user: { ...u, name: u.name || name, avatar_url: u.avatar_url || avatarUrl }, isNew: false };
  }

  if (email) {
    const byEmail = await pool.query(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()],
    );
    if (byEmail.rows.length > 0) {
      const u = byEmail.rows[0];
      await pool.query(
        `UPDATE users SET auth_provider = $1, provider_id = $2,
         name = COALESCE(name, $3), avatar_url = COALESCE(avatar_url, $4)
         WHERE id = $5`,
        [provider, providerId, name, avatarUrl, u.id],
      );
      return { user: { ...u, auth_provider: provider, provider_id: providerId, name: u.name || name, avatar_url: u.avatar_url || avatarUrl }, isNew: false };
    }
  }

  const consentFields = withConsent
    ? ', consent_accepted_at, consent_version'
    : '';
  const consentValues = withConsent
    ? ', NOW(), $6'
    : '';
  const params = [email?.toLowerCase() || null, name, provider, providerId, avatarUrl];
  if (withConsent) params.push(CONSENT_VERSION);

  const result = await pool.query(
    `INSERT INTO users (email, name, auth_provider, provider_id, avatar_url, credits, free_wan, free_veo, free_image${consentFields})
     VALUES ($1, $2, $3, $4, $5, ${WELCOME_CREDITS}, ${FREE_WAN_SSO}, ${FREE_VEO_SSO}, ${FREE_IMAGE_SSO}${consentValues}) RETURNING *`,
    params,
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
  res.cookie('oauth_consent', '1', COOKIE_OPTS);

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
    const hasConsent = req.cookies?.oauth_consent === '1';
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('oauth_consent', { path: '/' });

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
    const avatarUrl = profile.default_avatar_id && !profile.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null;

    const { user } = await findOrCreateSSOUser('yandex', String(profile.id), email, name, avatarUrl, hasConsent);
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
  res.cookie('oauth_consent', '1', COOKIE_OPTS);

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
    const hasConsent = req.cookies?.oauth_consent === '1';
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('pkce_verifier', { path: '/' });
    res.clearCookie('oauth_consent', { path: '/' });

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
    const avatarUrl = profile.avatar || null;

    const { user } = await findOrCreateSSOUser('vk', userId, email, name, avatarUrl, hasConsent);
    const token = issueToken(user);

    console.log(`[sso:vk] Login: user=${user.id} email=${user.email} provider_id=${userId}`);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[sso:vk] callback error:', err);
    res.redirect('/login?error=server');
  }
}
