/**
 * Which profile screen a `?tab=`/`#hash` link asks for.
 *
 * The password and 2FA cards live in a sub-navigation entry ("รหัสผ่าน &
 * ความปลอดภัย") of the account tab, not in a tab of their own — so
 * `?tab=security` has to open that section, otherwise the link silently lands
 * on "ข้อมูลส่วนตัว".
 */

export type ProfileTabKey =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'ai'
  | 'workspace';

export type ProfileAccountSection = 'account' | 'security';

export interface ProfileLocation {
  tab: ProfileTabKey;
  section: ProfileAccountSection;
}

const TAB_ALIASES: Record<string, ProfileTabKey> = {
  profile: 'profile',
  appearance: 'appearance',
  preferences: 'appearance',
  menu: 'appearance',
  notifications: 'notifications',
  alerts: 'notifications',
  ai: 'ai',
  workspace: 'workspace',
  admin: 'workspace',
};

const SECTION_ALIASES: Record<string, ProfileAccountSection> = {
  account: 'account',
  security: 'security',
  password: 'security',
};

/** Null when the link names nothing this page knows (keep the current screen). */
export function resolveProfileLocation(
  search: string,
  hash: string,
): ProfileLocation | null {
  const requested = new URLSearchParams(search).get('tab') || hash.replace('#', '');
  const key = requested.trim().toLowerCase();
  if (!key) return null;

  const section = SECTION_ALIASES[key];
  if (section) return { tab: 'profile', section };

  const tab = TAB_ALIASES[key];
  return tab ? { tab, section: 'account' } : null;
}
