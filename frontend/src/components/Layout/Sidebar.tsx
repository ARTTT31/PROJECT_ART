'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, LogOut, User, Cctv } from 'lucide-react'
import { isExternalUrl, parseQuickLinks, QUICK_LINK_ICON_MAP } from '@/utils/quickLinks'
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
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export default function Sidebar({ isOpen, isCollapsed = false, onClose, user, onLogout }: SidebarProps) {
  const pathname = usePathname()

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

  const menuItems: MenuSection[] = [
    {
      title: 'เมนูหลัก',
      items: [
        { name: 'หน้าหลัก', href: '/dashboard', icon: <Home size={20} aria-hidden="true" /> },
        { name: 'กล้องวงจรปิด', href: '/camera', icon: <Cctv size={20} aria-hidden="true" /> },
        { name: 'โปรไฟล์', href: '/profile', icon: <User size={20} aria-hidden="true" /> },
      ],
    },
    ...(quickLinkSection ? [quickLinkSection] : []),
  ]

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen w-[80vw] max-w-64 border-r border-slate-200/60 bg-white/90 shadow-glass-lg text-slate-900 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.12),transparent_42%),radial-gradient(circle_at_10%_90%,rgba(99,102,241,0.10),transparent_46%),linear-gradient(to_bottom,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200/60 p-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div>
              <div className="text-base font-bold tracking-wide text-slate-950">ART Workspace</div>
              <div className="text-[11px] font-semibold tracking-wide text-slate-500">Personal Dashboard</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {menuItems.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-3 text-[11px] font-bold tracking-wider text-slate-500">{section.title}</div>
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
                              ? 'bg-sky-500/10 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]'
                              : 'text-slate-700 hover:bg-white/70 hover:text-slate-950'
                          }`}
                          onClick={() => !item.external && onClose()}
                        >
                          <span className={isActive ? 'text-sky-700' : 'text-slate-500 group-hover:text-slate-700'}>{item.icon}</span>
                          <span className="flex-1">{item.name}</span>
                          {item.external && <span className="text-xs text-slate-400/90">↗</span>}
                        </ItemComponent>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200/60 p-4">
          <button
            onClick={onLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={20} aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </aside>
  )
}