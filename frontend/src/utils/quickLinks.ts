'use client'

import type { LucideIcon } from 'lucide-react'
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
} from 'lucide-react'

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
  | 'wrench'

export interface QuickLink {
  id: string
  label: string
  url: string
  icon: QuickLinkIconKey
  color?: string
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
}

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
]

export function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

function normalizeQuickLink(input: any): QuickLink | null {
  if (!input || typeof input !== 'object') return null

  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : null
  const label = typeof input.label === 'string' ? input.label.trim() : ''
  const url = typeof input.url === 'string' ? input.url.trim() : ''
  const icon = (typeof input.icon === 'string' ? input.icon : '') as QuickLinkIconKey
  const color = typeof input.color === 'string' ? input.color.trim() : undefined

  if (!label || !url) return null
  if (!Object.prototype.hasOwnProperty.call(QUICK_LINK_ICON_MAP, icon)) return null

  // ถ้าไม่มี id ให้สร้างแบบเบื้องต้น (ไว้ key ใน React)
  const safeId =
    id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)

  return { id: safeId, label, url, icon, color }
}

export function parseQuickLinks(raw: string | null | undefined): QuickLink[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeQuickLink).filter(Boolean) as QuickLink[]
  } catch {
    return []
  }
}

export function serializeQuickLinks(links: QuickLink[]) {
  // กันข้อมูลแปลก ๆ
  const cleaned = links
    .map((l) => normalizeQuickLink(l))
    .filter(Boolean) as QuickLink[]
  return JSON.stringify(cleaned)
}
