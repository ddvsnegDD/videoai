const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REGS = 2;
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 min

const map = new Map(); // ip → { count, resetAt }

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of map) {
    if (entry.resetAt <= now) map.delete(ip);
  }
}, CLEANUP_INTERVAL);

export function checkRegLimit(ip) {
  if (!ip) return { allowed: true };

  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || entry.resetAt <= now) {
    map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count < MAX_REGS) {
    entry.count++;
    return { allowed: true };
  }

  const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: false,
    retryAfterSec,
    message: 'С этого подключения недавно регистрировались. Попробуйте позже, войдите в существующий аккаунт, или зарегистрируйтесь с компьютера / другого подключения.',
  };
}
