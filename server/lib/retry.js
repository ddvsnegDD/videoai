/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<T>} fn — async function to retry
 * @param {object} opts
 * @param {number} opts.retries — max retry attempts (default 3)
 * @param {number} opts.delayMs — initial delay between retries (default 2000)
 * @param {number} opts.factor — delay multiplier per retry (default 2)
 * @param {string} opts.label — log prefix for retry messages
 * @returns {Promise<T>}
 */
export async function retryWithBackoff(fn, { retries = 3, delayMs = 2000, factor = 2, label = 'retry' } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      const wait = delayMs * factor ** i;
      console.warn(`[${label}] attempt ${i + 1}/${retries + 1} failed: ${err.message}, retrying in ${wait}ms…`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
