'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, ExternalLink, Sparkles } from 'lucide-react'
import { isExternalUrl, parseQuickLinks, QUICK_LINK_ICON_MAP } from '@/utils/quickLinks'
import {
  parseMainMenuConfig,
  MAIN_MENU_ICON_MAP,
  MAIN_MENU_STORAGE_KEY,
  MainMenuItemConfig,
} from '@/utils/mainMenu'
import { AuthUser } from '@/types'

interface SidebarProps {
  isOpen: boolean
  isCollapsed?: boolean
  onClose: () => void
  user: AuthUser | null
  onLogout: () => void
}

interface MenuItem {
  name: string
  href: string
  icon: JSX.Element
  external?: boolean
  isWip?: boolean
  wipLabel?: string
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export default function Sidebar({ isOpen, isCollapsed = false, onClose, user, onLogout }: SidebarProps) {
  const pathname = usePathname()

  const [mainMenuConfig, setMainMenuConfig] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null)
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY)
    return parseMainMenuConfig(saved)
  })

  // Listen for changes from Profile Page
  useEffect(() => {
    const handleMenuUpdate = () => {
      const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY)
      setMainMenuConfig(parseMainMenuConfig(saved))
    }
    window.addEventListener('art-main-menu-updated', handleMenuUpdate)
    window.addEventListener('storage', handleMenuUpdate)
    return () => {
      window.removeEventListener('art-main-menu-updated', handleMenuUpdate)
      window.removeEventListener('storage', handleMenuUpdate)
    }
  }, [])

  const quickLinks = parseQuickLinks(user?.quick_links)

  const quickLinkSection: MenuSection | null =
    quickLinks.length > 0
      ? {
          title: 'ควิกลิ้งค์',
          items: quickLinks.map((ql) => {
            const Icon = QUICK_LINK_ICON_MAP[ql.icon]
            const external = isExternalUrl(ql.url)
            return {
              name: ql.label,
              href: ql.url,
              external,
              icon: <Icon size={20} aria-hidden="true" style={{ color: ql.color || undefined }} />,
            }
          }),
        }
      : null

  // Active Main Menu Items based on user configuration
  const enabledMainItems = mainMenuConfig.filter((item) => item.enabled)

  const mainMenuItemsSection: MenuSection = {
    title: 'เมนูหลัก',
    items: enabledMainItems.map((item) => {
      const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles
      return {
        name: item.name,
        href: item.href,
        icon: <Icon size={20} aria-hidden="true" />,
        isWip: item.isWip,
        wipLabel: item.wipLabel,
      }
    }),
  }

  const menuSections: MenuSection[] = [
    mainMenuItemsSection,
    ...(quickLinkSection ? [quickLinkSection] : []),
  ]

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen w-[80vw] max-w-64 border-r border-slate-200/60 bg-white/80 backdrop-blur-md shadow-glass-lg text-slate-900 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
    >
      <div className="flex h-full flex-col">
        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-4 pt-6">
          <div className="space-y-6">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div
                  className="mb-2 px-3 text-[11px] font-semibold text-[#6e6e73]"
                >
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = !item.external && pathname === item.href
                    const ItemComponent = item.external ? 'a' : Link

                    return (
                      <li key={item.name}>
                        <ItemComponent
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                          className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            isActive
                              ? 'bg-[#0071e3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.30)]'
                              : 'text-slate-700 hover:bg-black/[0.04] hover:text-slate-900'
                          }`}
                          onClick={() => !item.external && onClose()}
                        >
                          <span className={isActive ? 'text-white/90' : 'text-slate-400 group-hover:text-slate-600'}>
                            {item.icon}
                          </span>
                          <span className="flex-1 truncate">{item.name}</span>

                          {/* WIP Indicator Badge */}
                          {item.isWip && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60'
                              }`}
                            >
                              {item.wipLabel || 'WIP'}
                            </span>
                          )}

                          {item.external && (
                            <ExternalLink
                              size={12}
                              aria-hidden="true"
                              className={isActive ? 'text-white/70' : 'text-slate-400/80'}
                            />
                          )}
                        </ItemComponent>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="border-t border-slate-200/60 p-4">
          <button
            type="button"
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-500 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            aria-label="ออกจากระบบ"
          >
            <LogOut size={20} aria-hidden="true" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </aside>
  )
}