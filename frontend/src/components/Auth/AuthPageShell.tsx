'use client'

import Image from 'next/image'

/**
 * Shared chrome for the account-email screens (forgot / reset / verify).
 *
 * Mirrors the login page's brand block inside the same `login-*` styles, so the
 * four pages look like one flow. The CSS is imported by each page (global CSS
 * is only imported from `app/`).
 */
export default function AuthPageShell({
  tagline,
  children,
}: {
  tagline: string
  children: React.ReactNode
}) {
  return (
    <main className="login-page">
      <section aria-label={tagline} className="login-shell">
        <div className="login-panel">
          <header className="login-brand">
            <Image
              src="/art-workspace-mark.svg"
              alt=""
              width={72}
              height={72}
              priority
              draggable={false}
              className="login-mark"
            />
            <h1 className="login-title">ART Workspace</h1>
            <p className="login-tagline">{tagline}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}
