'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// The styles for this boundary live here instead of in a CSS file. Next emits a
// <link rel="preload" as="style"> for every CSS file reachable from a route, so
// a stylesheet imported only by global-error.tsx was preloaded on every page
// and never used (Chrome logged "preloaded using link preload but not used").
// Inlining it also keeps the last-resort error page styled if its stylesheet
// request itself is what failed.
const globalErrorStyles = `
.global-error-body {
  margin: 0;
  min-height: 100dvh;
  background: #f5f5f7;
  color: #1d1d1f;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', Inter, Anuphan,
    system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.global-error-shell {
  display: flex;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.global-error-card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 28px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  text-align: center;
}

.global-error-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: rgba(255, 59, 48, 0.1);
  color: #d70015;
}

.global-error-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.global-error-text {
  margin: 0;
  color: #6e6e73;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
}

.global-error-detail {
  width: 100%;
  max-height: 160px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 11px;
  background: #f5f5f7;
  color: #d70015;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  white-space: pre-wrap;
}

.global-error-retry {
  margin-top: 8px;
  min-height: 52px;
  padding: 0 28px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 9999px;
  background: #0066cc;
  color: #ffffff;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 120ms cubic-bezier(0.4, 0, 0.2, 1);
}

.global-error-retry:hover {
  background: #0071e3;
}

.global-error-retry:active {
  transform: scale(0.95);
}

.global-error-retry:focus-visible {
  outline: 3px solid rgba(0, 102, 204, 0.45);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .global-error-retry {
    transition: none;
  }

  .global-error-retry:active {
    transform: none;
  }
}
`;

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Last-resort error boundary for the App Router.
 *
 * `error.tsx` only covers errors below the root layout; a render failure in the
 * layout itself (providers, fonts, session bootstrap) has nowhere to land and
 * previously surfaced as a blank page that Sentry never heard about. This file
 * catches that case, so it replaces the root layout and must render its own
 * <html> and <body> — and import its own stylesheet, because the layout's
 * imports do not apply here.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="th">
      <head>
        <style dangerouslySetInnerHTML={{ __html: globalErrorStyles }} />
      </head>
      <body className="global-error-body">
        <main className="global-error-shell" role="alert" aria-live="assertive">
          <section className="global-error-card">
            <span className="global-error-icon" aria-hidden="true">
              <AlertTriangle size={24} />
            </span>
            <h1 className="global-error-title">เกิดข้อผิดพลาด</h1>
            <p className="global-error-text">
              ระบบไม่สามารถโหลดหน้าเพจได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
              หากยังพบปัญหาเดิมกรุณาติดต่อผู้ดูแลระบบ
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="global-error-detail">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            )}
            <button type="button" onClick={reset} className="global-error-retry">
              <RotateCcw size={16} aria-hidden="true" />
              ลองใหม่
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
