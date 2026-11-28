/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';
import { isApiPathname } from '@/utils/swCacheRules';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// T11: API responses are auth-cookie scoped and session-private (they embed
// per-user data), so they must NEVER be answered from Cache Storage — not by
// /api/, and not by any handler lower down the defaultCache list. The rule is
// therefore registered FIRST, before every default rule.
const apiNeverCached: RuntimeCaching[] = [
  {
    matcher: ({ url }: { url: URL }) => isApiPathname(url),
    handler: new NetworkOnly(),
  },
];

// Live HLS manifests and segments are not cacheable: a cached manifest points at
// expired segments, and a cached response would also skip the request that wakes
// a sleeping MediaMTX/Render service. Register this before defaultCache's
// cross-origin NetworkFirst rule for the same reason as the API rule above.
const liveStreamNetworkOnly: RuntimeCaching[] = [
  {
    matcher: ({ url }: { url: URL }) => /\.(?:m3u8|ts|m4s|mp4|aac)$/i.test(url.pathname),
    handler: new NetworkOnly(),
  },
];

/**
 * Last-resort answer for a navigation that has neither a network nor a cached
 * copy. Returning a Response — even a tiny one — is the point: rejecting the
 * FetchEvent is what makes the browser log
 * `FetchEvent ... resulted in a network error response` and show its own error
 * page instead of ours.
 */
function offlineResponse(): Response {
  return new Response(
    '<!doctype html><html lang="th"><meta charset="utf-8"><title>ออฟไลน์</title>' +
      '<p style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;line-height:1.6">' +
      'ตอนนี้ออฟไลน์อยู่ และหน้านี้ยังไม่ได้ถูกบันทึกไว้ในเครื่อง กรุณาลองอีกครั้งเมื่อกลับมาออนไลน์</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Page navigations get their own route, registered before every default rule.
 *
 * `@serwist/next`'s page route matches `Content-Type: text/html` on the
 * *request*, which a navigation request never carries, so documents fell
 * through to the catch-all "others" bucket. Whenever the network failed and
 * that bucket had no cached copy either, the handler rejected with
 * `no-response` (uncaught in the console, navigation broken) instead of
 * rendering the offline shell. Here the chain is explicit — network, then a
 * cached page, then the precached offline shell — and one of the three always
 * answers, so a fetch event can no longer reject.
 */
const navigationRoute: RuntimeCaching = {
  matcher: ({ request }: { request: Request }) => request.mode === 'navigate',
  handler: new NetworkFirst({
    cacheName: 'pages',
    // A cold Render backend can hold a navigation far longer than a user waits;
    // after this the cached page (or the shell) takes over.
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
      {
        handlerDidError: async () =>
          (await serwist.matchPrecache('/offline.html')) ?? offlineResponse(),
      },
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...apiNeverCached,
    ...liveStreamNetworkOnly,
    navigationRoute,
    ...defaultCache,
  ],
  // A navigation that cannot reach the network (or a cached page) gets the
  // small, self-contained offline shell instead of the browser's error page.
  // `public/offline.html` is included in the precache manifest by the default
  // public glob.
  fallbacks: {
    entries: [
      {
        url: '/offline.html',
        matcher: ({ request }) => request.mode === 'navigate',
      },
    ],
  },
});

serwist.addEventListeners();

// A document cached by an older build carries that build's script tags and RSC
// payload, so once a new deployment lands it hydrates against the new chunks and
// React aborts with #418 ("server HTML didn't match the client"). Dropping the
// page cache on every activate keeps a cached document from outliving the build
// that wrote it; the offline shell below still answers when the network is down.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('pages'));
});

// Push Notifications
self.addEventListener('push', (event: PushEvent) => {
  let title = 'Workspace';
  let options: NotificationOptions = {
    body: 'คุณมีการแจ้งเตือนใหม่',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/dashboard' },
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options = {
        ...options,
        body: data.body || options.body,
        icon: data.icon || options.icon,
        data: {
          url: data.url || '/dashboard',
        },
      };
    } catch {
      options.body = event.data.text() || options.body;
    }
  }

  event.waitUntil(
    (async () => {
      if ('setAppBadge' in self.navigator) {
        try {
          const badgeCount =
            event.data && typeof event.data.json === 'function'
              ? (event.data.json()?.badgeCount ?? 1)
              : 1;
          await (self.navigator as unknown as { setAppBadge: (c?: number) => Promise<void> }).setAppBadge(badgeCount);
        } catch {
          // Badging may fail gracefully
        }
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  if ('clearAppBadge' in self.navigator) {
    try {
      void (self.navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge();
    } catch {}
  }
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
