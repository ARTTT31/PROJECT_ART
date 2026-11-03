'use client';

import type { LucideIcon } from 'lucide-react';
import { ALL_PAGES, canAccessPage, type PageAccessSubject } from './accessiblePages';
import {
  Bookmark,
  Briefcase,
  Calendar,
  FileText,
  Globe,
  Link as LinkIcon,
  Mail,
  Settings,
  Star,
  Home,
  Database,
  Users,
  Heart,
  Music,
  Camera,
  ShoppingBag,
  MapPin,
  Phone,
  Clock,
  Bell,
  BarChart3,
  Code,
  Image,
  Video,
  Zap,
  Shield,
  BookOpen,
  Coffee,
  Gamepad2,
  Headphones,
  Layers,
  Monitor,
  Palette,
  Rocket,
  Tag,
  Target,
  TrendingUp,
  Wifi,
  Wrench,
} from 'lucide-react';

export type QuickLinkIconKey =
  | 'link'
  | 'globe'
  | 'calendar'
  | 'file'
  | 'bookmark'
  | 'star'
  | 'settings'
  | 'mail'
  | 'briefcase'
  | 'home'
  | 'database'
  | 'users'
  | 'heart'
  | 'music'
  | 'camera'
  | 'shopping'
  | 'mappin'
  | 'phone'
  | 'clock'
  | 'bell'
  | 'chart'
  | 'code'
  | 'image'
  | 'video'
  | 'zap'
  | 'shield'
  | 'book'
  | 'coffee'
  | 'gamepad'
  | 'headphones'
  | 'layers'
  | 'monitor'
  | 'palette'
  | 'rocket'
  | 'tag'
  | 'target'
  | 'trending'
  | 'wifi'
  | 'wrench';

/** Alternate destinations a single shortcut can point at (internal tools). */
export type QuickLinkEnvironment = 'staging' | 'development';

export type QuickLinkEnvironmentKey = 'production' | QuickLinkEnvironment;

/** Sidebar chip text; short on purpose, the row is narrow. */
export const QUICK_LINK_ENVIRONMENT_LABELS: Record<QuickLinkEnvironmentKey, string> = {
  production: 'PROD',
  staging: 'STG',
  development: 'DEV',
};

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: QuickLinkIconKey;
  color?: string;
  /** Optional alternate URLs; `url` is always the production destination. */
  envs?: Partial<Record<QuickLinkEnvironment, string>>;
}

export const QUICK_LINK_ICON_MAP: Record<QuickLinkIconKey, LucideIcon> = {
  link: LinkIcon,
  globe: Globe,
  calendar: Calendar,
  file: FileText,
  bookmark: Bookmark,
  star: Star,
  settings: Settings,
  mail: Mail,
  briefcase: Briefcase,
  home: Home,
  database: Database,
  users: Users,
  heart: Heart,
  music: Music,
  camera: Camera,
  shopping: ShoppingBag,
  mappin: MapPin,
  phone: Phone,
  clock: Clock,
  bell: Bell,
  chart: BarChart3,
  code: Code,
  image: Image,
  video: Video,
  zap: Zap,
  shield: Shield,
  book: BookOpen,
  coffee: Coffee,
  gamepad: Gamepad2,
  headphones: Headphones,
  layers: Layers,
  monitor: Monitor,
  palette: Palette,
  rocket: Rocket,
  tag: Tag,
  target: Target,
  trending: TrendingUp,
  wifi: Wifi,
  wrench: Wrench,
};

export const QUICK_LINK_ICON_OPTIONS: Array<{ key: QuickLinkIconKey; label: string }> = [
  { key: 'link', label: 'ลิงก์' },
  { key: 'globe', label: 'เว็บไซต์' },
  { key: 'calendar', label: 'ปฏิทิน' },
  { key: 'file', label: 'ไฟล์/เอกสาร' },
  { key: 'bookmark', label: 'บุ๊คมาร์ค' },
  { key: 'star', label: 'รายการโปรด' },
  { key: 'settings', label: 'ตั้งค่า' },
  { key: 'mail', label: 'อีเมล' },
  { key: 'briefcase', label: 'งาน/โปรเจกต์' },
  { key: 'home', label: 'หน้าแรก' },
  { key: 'database', label: 'ฐานข้อมูล' },
  { key: 'users', label: 'ผู้ใช้' },
  { key: 'heart', label: 'หัวใจ' },
  { key: 'music', label: 'เพลง' },
  { key: 'camera', label: 'กล้อง' },
  { key: 'shopping', label: 'ช้อปปิ้ง' },
  { key: 'mappin', label: 'แผนที่' },
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'clock', label: 'นาฬิกา' },
  { key: 'bell', label: 'กระดิ่ง' },
  { key: 'chart', label: 'กราฟ' },
  { key: 'code', label: 'โค้ด' },
  { key: 'image', label: 'รูปภาพ' },
  { key: 'video', label: 'วิดีโอ' },
  { key: 'zap', label: 'สายฟ้า' },
  { key: 'shield', label: 'โล่' },
  { key: 'book', label: 'หนังสือ' },
  { key: 'coffee', label: 'กาแฟ' },
  { key: 'gamepad', label: 'เกม' },
  { key: 'headphones', label: 'หูฟัง' },
  { key: 'layers', label: 'ชั้น' },
  { key: 'monitor', label: 'จอ' },
  { key: 'palette', label: 'จานสี' },
  { key: 'rocket', label: 'จรวด' },
  { key: 'tag', label: 'แท็ก' },
  { key: 'target', label: 'เป้าหมาย' },
  { key: 'trending', label: 'แนวโน้ม' },
  { key: 'wifi', label: 'ไวไฟ' },
  { key: 'wrench', label: 'ประแจ' },
];

export function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * A destination this app is willing to render: an absolute http(s) URL or a
 * single-slash in-app path. Protocol-relative (`//host`) and other schemes
 * (`javascript:`, `data:`, `file:`) are rejected — the server applies the same
 * rule in `backend/app/core/quick_links.py`.
 */
export function isQuickLinkUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true;
  return isExternalUrl(trimmed);
}

const QUICK_LINK_ENV_KEYS: QuickLinkEnvironment[] = ['staging', 'development'];

function normalizeEnvironments(raw: unknown): QuickLink['envs'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const envs: Partial<Record<QuickLinkEnvironment, string>> = {};
  for (const key of QUICK_LINK_ENV_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && isQuickLinkUrl(value)) envs[key] = value.trim();
  }
  return Object.keys(envs).length > 0 ? envs : undefined;
}

export interface QuickLinkEnvironmentOption {
  key: QuickLinkEnvironmentKey;
  label: string;
  url: string;
}

/** Every destination this link offers, production first. */
export function quickLinkEnvironmentOptions(link: QuickLink): QuickLinkEnvironmentOption[] {
  const options: QuickLinkEnvironmentOption[] = [
    { key: 'production', label: QUICK_LINK_ENVIRONMENT_LABELS.production, url: link.url },
  ];
  for (const key of QUICK_LINK_ENV_KEYS) {
    const url = link.envs?.[key];
    if (url) options.push({ key, label: QUICK_LINK_ENVIRONMENT_LABELS[key], url });
  }
  return options;
}

/** The URL for a chosen environment; unknown values fall back to production. */
export function resolveQuickLinkUrl(
  link: QuickLink,
  environment: string | null | undefined,
): string {
  if (!environment || environment === 'production') return link.url;
  return link.envs?.[environment as QuickLinkEnvironment] ?? link.url;
}

/**
 * Human-readable summary of a quick link's destination, used by the settings
 * card and the create/edit dialog so both describe a link the same way.
 */
export function describeQuickLink(url: string) {
  const value = url.trim();
  if (!value) {
    return { tone: 'ยังไม่ระบุ', title: 'รอระบุปลายทาง', subtitle: 'ลิงก์นี้จะแสดงใน Sidebar' };
  }
  if (isExternalUrl(value)) {
    try {
      const parsed = new URL(value);
      return {
        tone: 'ภายนอก',
        title: parsed.hostname.replace(/^www\./, '') || value,
        subtitle: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : 'ลิงก์ภายนอก',
      };
    } catch {
      return { tone: 'ภายนอก', title: value, subtitle: 'ลิงก์ภายนอก' };
    }
  }
  return { tone: 'ภายใน', title: 'เส้นทางภายในระบบ', subtitle: value };
}

function normalizeQuickLink(input: any): QuickLink | null {
  if (!input || typeof input !== 'object') return null;

  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : null;
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const icon = (typeof input.icon === 'string' ? input.icon : '') as QuickLinkIconKey;
  const color = typeof input.color === 'string' ? input.color.trim() : undefined;
  const envs = normalizeEnvironments(input.envs);

  if (!label || !url) return null;
  if (!Object.prototype.hasOwnProperty.call(QUICK_LINK_ICON_MAP, icon)) return null;

  // ถ้าไม่มี id ให้สร้างแบบเบื้องต้น (ไว้ key ใน React)
  const safeId =
    id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  return { id: safeId, label, url, icon, color, envs };
}

/**
 * A new id for a link created outside the profile form (the sidebar's "save
 * this page" suggestion). Kept at module scope so no component render path
 * calls an impure generator.
 */
export function newQuickLinkId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ql_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseQuickLinks(raw: string | null | undefined): QuickLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeQuickLink).filter(Boolean) as QuickLink[];
  } catch {
    return [];
  }
}

export function serializeQuickLinks(links: QuickLink[]) {
  // กันข้อมูลแปลก ๆ
  const cleaned = links.map((l) => normalizeQuickLink(l)).filter(Boolean) as QuickLink[];
  return JSON.stringify(cleaned);
}

// ── Page-access awareness ────────────────────────────────────────────────────
// A quick link can point at an in-app route, so it has to obey the same
// permission gate as the main menu. A browser bookmark cannot know that this
// account may not open /camera — this is what makes the link part of the
// workspace instead of a URL that happens to be stored here.

/** In-app routes only an admin may open. */
const ADMIN_ONLY_SEGMENTS = ['admin', 'audit'];

/** The page id an in-app URL belongs to, or null for external/root links. */
export function quickLinkPageId(url: string): string | null {
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  const [path] = url.split(/[?#]/);
  const segment = path.split('/').filter(Boolean)[0];
  return segment ?? null;
}

/** Whether this link should be rendered for this account. */
export function isQuickLinkVisible(
  link: Pick<QuickLink, 'url'>,
  user: PageAccessSubject | null | undefined,
): boolean {
  const pageId = quickLinkPageId(link.url);
  if (!pageId) return true;
  if (ADMIN_ONLY_SEGMENTS.includes(pageId)) return user?.role === 'admin';
  // Only the pages this product knows about have a permission of their own;
  // an unknown deep route is not a reason to hide the link.
  if (!(ALL_PAGES as readonly string[]).includes(pageId)) return true;
  return canAccessPage(user, pageId);
}
