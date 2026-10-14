/**
 * Shared rules for the service worker (src/app/sw.ts) and logout (T11).
 *
 * Kept in a plain module so vitest can verify the core invariants — API
 * responses must never be served from Cache Storage, and logout wipes every
 * cache region — without spinning up a real service worker.
 */

/** API responses are auth-cookie scoped and session-private: network only. */
export function isApiPathname(url: URL): boolean {
  return url.pathname.startsWith("/api/")
}

/** Delete every Cache Storage region; returns how many regions were wiped. */
export async function clearServiceWorkerCaches(): Promise<number> {
  if (typeof window === "undefined" || !("caches" in window)) return 0
  const names = await caches.keys()
  await Promise.all(names.map((name) => caches.delete(name)))
  return names.length
}
