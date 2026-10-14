/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { isApiPathname } from "@/utils/swCacheRules";

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
});

serwist.addEventListeners();
