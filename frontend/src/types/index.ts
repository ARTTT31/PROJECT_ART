/**
 * Shared TypeScript interfaces for ART Workspace
 * Centralized type definitions to replace `any` usage across the app
 */

/** User data shape returned from the API and stored in localStorage */
export interface DashboardUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'user' | string
  avatar?: string | null
  quick_links?: string | null
}

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
