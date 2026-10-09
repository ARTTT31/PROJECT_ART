'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import '../styles/global-error.css'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
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
    console.error('[GlobalError]', error)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <html lang="th">
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
  )
}
