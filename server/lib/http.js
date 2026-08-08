// Shared provider fetch with a hard deadline. A stalled provider must abort and
// throw so routes activate their quiet fallbacks instead of freezing the turn.
// At most one bounded retry on 429/5xx, and only if the deadline allows it.
export async function fetchWithDeadline(url, options, timeoutMs) {
  const started = Date.now();

  const attempt = async (ms) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const res = await attempt(timeoutMs);
  if (res.status === 429 || res.status >= 500) {
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining > 2000) return attempt(remaining);
  }
  return res;
}
