/**
 * Tiny in-memory TTL cache, scoped to a warm serverless instance.
 * Concurrent callers for the same key share one in-flight promise.
 */
const store = new Map();

export async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.promise;

  const promise = Promise.resolve().then(loader);
  store.set(key, { promise, expires: now + ttlMs });
  try {
    return await promise;
  } catch (err) {
    store.delete(key); // don't cache failures
    throw err;
  }
}

export function invalidate(key) {
  store.delete(key);
}
