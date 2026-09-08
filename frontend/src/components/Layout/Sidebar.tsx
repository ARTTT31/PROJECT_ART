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
      className={`fixed left-0 top-0 z-40 h-screen w-[80vw] max-w-64 border-r border-black/[0.06] bg-[rgba(255,255,255,0.82)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1d1d1f] transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
    >
      <div className="flex h-full flex-col">
        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3.5 pt-6">
          <div className="space-y-6">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div
                  className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-[#86868b]"
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
                          className={`group flex min-h-[48px] items-center gap-2.5 rounded-[12px] px-3 py-2 text-[14px] font-semibold transition-all duration-150 active:scale-[0.98] ${
                            isActive
                              ? 'bg-[#0071e3] text-white shadow-[0_4px_14px_rgba(0,113,227,0.30)]'
                              : 'text-[#1d1d1f] hover:bg-black/[0.05] hover:text-[#1d1d1f]'
                          }`}
                          onClick={() => !item.external && onClose()}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'text-[#6e6e73] group-hover:text-[#1d1d1f]'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="flex-1 truncate">{item.name}</span>

                          {/* WIP Indicator Badge */}
                          {item.isWip && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#ff9500]/10 text-[#ff9500]'
                              }`}
                            >
                              {item.wipLabel || 'WIP'}
                            </span>
                          )}

                          {item.external && (
                            <ExternalLink
                              size={12}
                              aria-hidden="true"
                              className={isActive ? 'text-white/70' : 'text-[#86868b]'}
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
        <div className="border-t border-black/[0.06] p-3.5">
          <button
            type="button"
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex min-h-[48px] w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-[14px] font-semibold text-[#ff3b30] transition-all duration-150 hover:bg-[#ff3b30]/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b30]"
            aria-label="ออกจากระบบ"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#ff3b30]/10 text-[#ff3b30]">
              <LogOut size={16} aria-hidden="true" />
            </span>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </aside>
  )
}