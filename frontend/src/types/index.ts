/**
 * Shared TypeScript interfaces for ART Workspace
 * Centralized type definitions to replace `any` usage across the app
 */

/** User role type */
export type AuthRole = 'admin' | 'user' | string

/** Canonical user data shape — used by Auth system, API, and all components */
export interface AuthUser {
  id: number
  email: string
  name: string
  role: AuthRole
  avatar?: string | null
  quick_links?: string | null
}

/** @deprecated Use AuthUser instead */
export type DashboardUser = AuthUser

/** Widget configuration stored in localStorage */
export interface WidgetConfig {
  id: string
  w: number
}

/** Widget width values: 1 = half, 2 = two-thirds, 3 = full */
export type WidgetWidth = 1 | 2 | 3

/** User session data returned from /profile/sessions API */
export interface UserSession {
  id: number
  session_id: string
  device_label: string
  user_agent: string | null
  ip_address: string
  is_active: boolean
  last_activity: string | null
  created_at: string | null
}

/** Parsed browser and OS info from a User-Agent string */
export interface ParsedUA {
  browser: string
  os: string
  isMobile: boolean
}
