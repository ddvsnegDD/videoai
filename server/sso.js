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

// ── Login flow: find user by identity or create new ──

async function findOrCreateSSOUser(provider, providerId, email, name, avatarUrl, withConsent) {
  // 1. Search user_identities table (primary lookup)
  const byIdentity = await pool.query(
    `SELECT u.* FROM users u JOIN user_identities ui ON u.id = ui.user_id
     WHERE ui.provider = $1 AND ui.provider_id = $2 LIMIT 1`,
    [provider, providerId],
  );
  if (byIdentity.rows.length > 0) {
    const u = byIdentity.rows[0];
    await pool.query(
      `UPDATE users SET name = COALESCE(name, $1), avatar_url = COALESCE(avatar_url, $2) WHERE id = $3`,
      [name, avatarUrl, u.id],
    );
    // Update identity metadata
    await pool.query(
      `UPDATE user_identities SET provider_email = $1, provider_name = $2, avatar_url = $3
       WHERE provider = $4 AND provider_id = $5`,
      [email, name, avatarUrl, provider, providerId],
    );
    return { user: { ...u, name: u.name || name, avatar_url: u.avatar_url || avatarUrl }, isNew: false };
  }

  // 2. Not found in identities — create new user
  //    (НЕ связываем аккаунты молча по совпадению email)
  const consentFields = withConsent ? ', consent_accepted_at, consent_version' : '';
  const consentValues = withConsent ? ', NOW(), $4' : '';
  const params = [email?.toLowerCase() || null, name, avatarUrl];
  if (withConsent) params.push(CONSENT_VERSION);

  const result = await pool.query(
    `INSERT INTO users (email, name, avatar_url, credits, free_wan, free_veo, free_image${consentFields})
     VALUES ($1, $2, $3, ${WELCOME_CREDITS}, ${FREE_WAN_SSO}, ${FREE_VEO_SSO}, ${FREE_IMAGE_SSO}${consentValues}) RETURNING *`,
    params,
  );
  const newUser = result.rows[0];

  // Create identity record
  await pool.query(
    `INSERT INTO user_identities (user_id, provider, provider_id, provider_email, provider_name, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [newUser.id, provider, providerId, email, name, avatarUrl],
  );

  return { user: newUser, isNew: true };
}

// ── Link flow: bind provider to an existing logged-in user ──

async function linkProviderToUser(userId, provider, providerId, email, name, avatarUrl) {
  // Check if this provider+provider_id already belongs to someone
  const existing = await pool.query(
    `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2`,
    [provider, providerId],
  );
  if (existing.rows.length > 0) {
    if (existing.rows[0].user_id === userId) {
      return { ok: true, alreadyLinked: true };
    }
    return { ok: false, error: 'conflict' };
  }

  await pool.query(
    `INSERT INTO user_identities (user_id, provider, provider_id, provider_email, provider_name, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, provider, providerId, email, name, avatarUrl],
  );
  return { ok: true };
}

function issueToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

/** Verify JWT from cookie, return userId or null */
function verifyTokenCookie(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

// ── Yandex ID ──

export function yandexInit(req, res) {
  const isLink = req.query.link === '1';

  if (isLink) {
    const uid = verifyTokenCookie(req);
    if (!uid) return res.redirect('/account?link_error=auth');
    res.cookie('sso_link_uid', String(uid), COOKIE_OPTS);
  }

  const state = generateState();
  res.cookie('oauth_state', state, COOKIE_OPTS);
  if (!isLink) res.cookie('oauth_consent', '1', COOKIE_OPTS);

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
    const linkUserId = req.cookies?.sso_link_uid;
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('oauth_consent', { path: '/' });
    res.clearCookie('sso_link_uid', { path: '/' });

    const errorRedirect = linkUserId ? '/account' : '/login';

    if (!code || !state || state !== savedState) {
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=csrf`);
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
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=token`);
    }
    const tokenData = await tokenRes.json();

    const profileRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      console.error('[sso:yandex] profile error:', await profileRes.text());
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=profile`);
    }
    const profile = await profileRes.json();

    const email = profile.default_email || profile.emails?.[0];
    const name = profile.display_name || profile.real_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;
    const avatarUrl = profile.default_avatar_id && !profile.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null;

    // ── LINK FLOW ──
    if (linkUserId) {
      const result = await linkProviderToUser(
        Number(linkUserId), 'yandex', String(profile.id), email, name, avatarUrl,
      );
      if (!result.ok) {
        console.log(`[sso:yandex] Link conflict: user=${linkUserId} provider_id=${profile.id} error=${result.error}`);
        return res.redirect(`/account?link_error=${result.error}`);
      }
      console.log(`[sso:yandex] Linked: user=${linkUserId} provider_id=${profile.id}`);
      return res.redirect('/account?linked=yandex');
    }

    // ── LOGIN FLOW ──
    const result = await findOrCreateSSOUser('yandex', String(profile.id), email, name, avatarUrl, hasConsent);
    const token = issueToken(result.user);

    console.log(`[sso:yandex] Login: user=${result.user.id} email=${result.user.email} provider_id=${profile.id}`);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.redirect(result.isNew ? '/dashboard?registered=1' : '/dashboard');
  } catch (err) {
    console.error('[sso:yandex] callback error:', err);
    const linkUserId = req.cookies?.sso_link_uid;
    res.redirect(linkUserId ? '/account?link_error=server' : '/login?error=server');
  }
}

// ── VK ID (OAuth 2.1 + PKCE) ──

export function vkInit(req, res) {
  const isLink = req.query.link === '1';

  if (isLink) {
    const uid = verifyTokenCookie(req);
    if (!uid) return res.redirect('/account?link_error=auth');
    res.cookie('sso_link_uid', String(uid), COOKIE_OPTS);
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  res.cookie('oauth_state', state, COOKIE_OPTS);
  res.cookie('pkce_verifier', codeVerifier, COOKIE_OPTS);
  if (!isLink) res.cookie('oauth_consent', '1', COOKIE_OPTS);

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
    const linkUserId = req.cookies?.sso_link_uid;
    res.clearCookie('oauth_state', { path: '/' });
    res.clearCookie('pkce_verifier', { path: '/' });
    res.clearCookie('oauth_consent', { path: '/' });
    res.clearCookie('sso_link_uid', { path: '/' });

    const errorRedirect = linkUserId ? '/account' : '/login';

    if (!code || !state || state !== savedState || !codeVerifier) {
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=csrf`);
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
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=token`);
    }
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('[sso:vk] token error response:', tokenData);
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=token`);
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
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=profile`);
    }
    const profileData = await profileRes.json();
    const profile = profileData.user || profileData;

    if (profileData.error) {
      console.error('[sso:vk] profile error response:', profileData);
      return res.redirect(`${errorRedirect}?${linkUserId ? 'link_error' : 'error'}=profile`);
    }

    const userId = String(profile.user_id || profile.id);
    const email = profile.email || tokenData.email || null;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;
    const avatarUrl = profile.avatar || null;

    // ── LINK FLOW ──
    if (linkUserId) {
      const result = await linkProviderToUser(
        Number(linkUserId), 'vk', userId, email, name, avatarUrl,
      );
      if (!result.ok) {
        console.log(`[sso:vk] Link conflict: user=${linkUserId} provider_id=${userId} error=${result.error}`);
        return res.redirect(`/account?link_error=${result.error}`);
      }
      console.log(`[sso:vk] Linked: user=${linkUserId} provider_id=${userId}`);
      return res.redirect('/account?linked=vk');
    }

    // ── LOGIN FLOW ──
    const result = await findOrCreateSSOUser('vk', userId, email, name, avatarUrl, hasConsent);
    const token = issueToken(result.user);

    console.log(`[sso:vk] Login: user=${result.user.id} email=${result.user.email} provider_id=${userId}`);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.redirect(result.isNew ? '/dashboard?registered=1' : '/dashboard');
  } catch (err) {
    console.error('[sso:vk] callback error:', err);
    const linkUserId = req.cookies?.sso_link_uid;
    res.redirect(linkUserId ? '/account?link_error=server' : '/login?error=server');
  }
}
