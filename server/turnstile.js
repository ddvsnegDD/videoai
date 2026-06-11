const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || '';

export async function verifyTurnstile(token, remoteIp) {
  if (!TURNSTILE_SECRET) return true;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: remoteIp }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return true;
  }
}
