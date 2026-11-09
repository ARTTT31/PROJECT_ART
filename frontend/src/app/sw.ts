/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';
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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...apiNeverCached, ...defaultCache],
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

// Push Notifications
self.addEventListener('push', (event: PushEvent) => {
  let title = 'ART Workspace';
  let options: NotificationOptions = {
    body: 'คุณมีการแจ้งเตือนใหม่',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
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
