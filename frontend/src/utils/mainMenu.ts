'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Home,
  Cctv,
  User,
  Calendar,
  BarChart3,
  FileText,
  Settings,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react'

export interface MainMenuItemConfig {
  id: string
  name: string
  href: string
  icon: string
  enabled: boolean
  isWip?: boolean
  wipLabel?: string
  required?: boolean
  description?: string
}

export const MAIN_MENU_ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  camera: Cctv,
  user: User,
  calendar: Calendar,
  chart: BarChart3,
  file: FileText,
  settings: Settings,
  shield: Shield,
  layers: Layers,
  sparkles: Sparkles,
}

export const DEFAULT_MAIN_MENU_ITEMS: MainMenuItemConfig[] = [
  {
    id: 'dashboard',
    name: 'หน้าหลัก',
    href: '/dashboard',
    icon: 'home',
    enabled: true,
    required: true,
    description: 'ศูนย์รวมแดชบอร์ด วิดเจ็ต และข้อมูลประจำวัน',
  },
  {
    id: 'camera',
    name: 'กล้องวงจรปิด',
    href: '/camera',
    icon: 'camera',
    enabled: true,
    description: 'ระบบมอนิเตอร์กล้อง CCTV สดและ Snapshot',
  },
  {
    id: 'profile',
    name: 'โปรไฟล์',
    href: '/profile',
    icon: 'user',
    enabled: true,
    description: 'จัดการข้อมูลส่วนตัว ความปลอดภัย และการตั้งค่า',
  },
  {
    id: 'schedule',
    name: 'ตารางงาน & ปฏิทิน',
    href: '/schedule',
    icon: 'calendar',
    enabled: false,
    isWip: true,
    wipLabel: 'กำลังพัฒนา',
    description: 'ระบบนัดหมาย กำหนดการ และกิจกรรมของทีม',
  },
]

export const MAIN_MENU_STORAGE_KEY = 'artMainMenuConfigV3'

export function parseMainMenuConfig(raw: string | null | undefined): MainMenuItemConfig[] {
  if (!raw) return DEFAULT_MAIN_MENU_ITEMS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_MAIN_MENU_ITEMS

    // Merge with defaults to preserve new items & structure
    const map = new Map<string, any>(parsed.map((item) => [item.id, item]))
    return DEFAULT_MAIN_MENU_ITEMS.map((defaultItem) => {
      const saved = map.get(defaultItem.id)
      if (!saved) return defaultItem
      return {
        ...defaultItem,
        enabled: defaultItem.required ? true : Boolean(saved.enabled),
      }
    })
  } catch {
    return DEFAULT_MAIN_MENU_ITEMS
  }
}

export function serializeMainMenuConfig(items: MainMenuItemConfig[]): string {
  const minimal = items.map(({ id, enabled }) => ({ id, enabled }))
  return JSON.stringify(minimal)
}
