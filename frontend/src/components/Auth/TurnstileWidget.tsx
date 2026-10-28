'use client';

import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'cf-turnstile-script';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget (optional).
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, which is the
 * default: a deployment without Turnstile must keep working. When configured,
 * the widget calls `onToken` with the token (or an empty string on
 * expiry/failure) and the form submits it with the request.
 */
export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        language: 'th',
        theme: 'light',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };

    const cleanup = () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone (script reloaded); nothing to clean up.
        }
      }
      widgetIdRef.current = null;
    };

    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);

    return () => {
      cancelled = true;
      script?.removeEventListener('load', render);
      cleanup();
    };
  }, [onToken]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="login-turnstile" />;
}
