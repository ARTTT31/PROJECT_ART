/**
 * Page access (`users.accessible_pages`) — one parser for the whole app.
 *
 * The value arrives as a JSON string (or an already-parsed array), and a NULL
 * means "never configured", which is the historic default of dashboard +
 * profile — the same list the backend applies. Keeping one implementation here
 * means the sidebar, the profile page and the page guard cannot drift apart on
 * what "no value" means.
 */

/** Pages an account gets when `accessible_pages` was never set. */
export const DEFAULT_PAGES = ['dashboard', 'profile'] as const

/** Every page the product knows about, in menu order. */
export const ALL_PAGES = ['dashboard', 'profile', 'camera'] as const

export type PageId = (typeof ALL_PAGES)[number]

/** Minimal user shape this module needs (works for AuthUser and API rows). */
export interface PageAccessSubject {
  role?: string | null
  accessible_pages?: string | string[] | null
}

/** Page ids an account may open. Anything unusable falls back to the default. */
export function parseAccessiblePages(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [...DEFAULT_PAGES]
  if (Array.isArray(raw)) {
    return raw.filter((page): page is string => typeof page === 'string')
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_PAGES]
    return parsed.filter((page): page is string => typeof page === 'string')
  } catch {
    return [...DEFAULT_PAGES]
  }
}

/** Whether the account may open `pageId`. Admins are never gated. */
export function canAccessPage(
  user: PageAccessSubject | null | undefined,
  pageId: string,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return parseAccessiblePages(user.accessible_pages).includes(pageId)
}
