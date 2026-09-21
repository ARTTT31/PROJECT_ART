import * as Sentry from '@sentry/nextjs'

export const onRequestError = Sentry.captureRequestError

/** Initialise server/edge monitoring only when a DSN has been configured. */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
  })
}
