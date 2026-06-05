'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Cloud, Database, Home, LogOut, User } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  user: any
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

export default function Sidebar({ isOpen, onClose, user, onLogout }: SidebarProps) {
  const pathname = usePathname()

  const menuItems: MenuSection[] = [
    {
      title: 'เมนูหลัก',
      items: [
        { name: 'หน้าหลัก', href: '/dashboard', icon: <Home size={20} aria-hidden="true" /> },
        { name: 'โปรไฟล์', href: '/profile', icon: <User size={20} aria-hidden="true" /> },
      ],
    },
    {
      title: 'เครื่องมือ',
      items: [
        { name: 'Google Drive', href: 'https://drive.google.com', icon: <Cloud size={20} aria-hidden="true" />, external: true },
        { name: 'Google Calendar', href: 'https://calendar.google.com', icon: <CalendarDays size={20} aria-hidden="true" />, external: true },
        { name: 'จัดการ Database', href: 'https://docs.google.com/spreadsheets', icon: <Database size={20} aria-hidden="true" />, external: true },
      ],
    },
  ]

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/20 bg-slate-900/70 backdrop-blur-[32px] shadow-glass-xl text-white transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.05),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(30,58,138,0.2),transparent_50%),linear-gradient(to_bottom,#0f172a,#1e293b)]" aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-white/5 p-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div>
              <div className="text-base font-bold tracking-wider text-white">ART WORKSPACE</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Personal Dashboard</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {menuItems.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{section.title}</div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    const ItemComponent = item.external ? 'a' : Link

                    return (
                      <li key={item.name}>
                        <ItemComponent
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                          className={`group flex min-h-11 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                            isActive
                              ? 'bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] text-white'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => !item.external && onClose()}
                        >
                          <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}>{item.icon}</span>
                          <span className="flex-1">{item.name}</span>
                          {item.external && <span className="text-xs text-slate-500/80">↗</span>}
                        </ItemComponent>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/5 p-4">
          <button
            onClick={onLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-red-400/90 transition-all duration-300 hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut size={20} aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </aside>
  )
}
