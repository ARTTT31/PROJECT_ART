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
]

export const MAIN_MENU_STORAGE_KEY = 'artMainMenuConfigV4'

export function parseMainMenuConfig(raw: string | null | undefined): MainMenuItemConfig[] {
  if (!raw) return DEFAULT_MAIN_MENU_ITEMS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_MAIN_MENU_ITEMS

    const defaultMap = new Map(DEFAULT_MAIN_MENU_ITEMS.map((item) => [item.id, item]))
    const seen = new Set<string>()
    const ordered: MainMenuItemConfig[] = []

    for (const saved of parsed) {
      if (!saved || typeof saved.id !== 'string') continue
      const fallback = defaultMap.get(saved.id)
      if (!fallback) continue
      seen.add(fallback.id)
      ordered.push({
        ...fallback,
        enabled: fallback.required ? true : Boolean(saved.enabled),
      })
    }

    for (const fallback of DEFAULT_MAIN_MENU_ITEMS) {
      if (!seen.has(fallback.id)) ordered.push(fallback)
    }

    return ordered
  } catch {
    return DEFAULT_MAIN_MENU_ITEMS
  }
}

export function serializeMainMenuConfig(items: MainMenuItemConfig[]): string {
  const minimal = items.map(({ id, enabled }) => ({ id, enabled }))
  return JSON.stringify(minimal)
}
