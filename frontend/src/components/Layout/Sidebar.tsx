'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, LogOut, User, Cctv, ExternalLink, Settings2, Plus } from 'lucide-react'
import { isExternalUrl, parseQuickLinks, QuickLink, QUICK_LINK_ICON_MAP } from '@/utils/quickLinks'
import { AuthUser } from '@/types'
import QuickLinksModal from './QuickLinksModal'

interface SidebarProps {
  isOpen: boolean
  isCollapsed?: boolean
  onClose: () => void
  user: AuthUser | null
  onLogout: () => void
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  {
    id: 'ql-salesforce',
    label: 'Salesforce',
    url: 'https://salesforce.com',
    icon: 'briefcase',
    color: '#0071e3',
  },
  {
    id: 'ql-onebook',
    label: 'OneBook HR',
    url: 'https://onebook.co.th',
    icon: 'users',
    color: '#0ea5e9',
  },
  {
    id: 'ql-zebra',
    label: 'Zebra Learning',
    url: 'https://learning.zebra.com',
    icon: 'book',
    color: '#10b981',
  },
]

export default function Sidebar({ isOpen, isCollapsed = false, onClose, user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [links, setLinks] = useState<QuickLink[]>(() => {
    if (user?.quick_links) {
      const parsed = parseQuickLinks(user.quick_links)
      if (parsed.length > 0) return parsed
    }
    return DEFAULT_QUICK_LINKS
  })

  // Sync with user prop or localStorage
  useEffect(() => {
    if (user?.quick_links) {
      const parsed = parseQuickLinks(user.quick_links)
      if (parsed.length > 0) {
        setLinks(parsed)
        return
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const localSaved = localStorage.getItem('artQuickLinksV2')
        if (localSaved) {
          const parsed = parseQuickLinks(localSaved)
          if (parsed.length > 0) {
            setLinks(parsed)
            return
          }
        }
      } catch {}
    }
  }, [user?.quick_links])

  const handleSaveLinks = (newLinks: QuickLink[]) => {
    setLinks(newLinks)
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-[80vw] max-w-64 border-r border-slate-200/60 bg-white/80 backdrop-blur-md shadow-glass-lg text-slate-900 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
      >
        <div className="flex h-full flex-col">
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4 pt-6 space-y-6">
            {/* Main Menu Section */}
            <div>
              <div className="mb-2 px-3 text-[11px] font-semibold text-slate-500">
                เมนูหลัก
              </div>
              <ul className="space-y-1">
                {[
                  { name: 'หน้าหลัก', href: '/dashboard', icon: <Home size={20} /> },
                  { name: 'กล้องวงจรปิด', href: '/camera', icon: <Cctv size={20} /> },
                  { name: 'โปรไฟล์', href: '/profile', icon: <User size={20} /> },
                ].map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? 'bg-[#0071e3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.30)]'
                            : 'text-slate-700 hover:bg-black/[0.04] hover:text-slate-900'
                        }`}
                      >
                        <span className={isActive ? 'text-white/90' : 'text-slate-400 group-hover:text-slate-600'}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Quick Links Section with Manage Button */}
            <div>
              <div className="mb-2 flex items-center justify-between px-3">
                <span className="text-[11px] font-semibold text-slate-500">
                  ควิกลิ้งค์
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md p-1 text-[11px] font-semibold text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="ปรับแต่งควิกลิ้งค์"
                  aria-label="ตั้งค่าควิกลิ้งค์"
                >
                  <Settings2 size={13} />
                  <span>จัดการ</span>
                </button>
              </div>

              <ul className="space-y-1">
                {links.map((item) => {
                  const Icon = QUICK_LINK_ICON_MAP[item.icon] || ExternalLink
                  const external = isExternalUrl(item.url)
                  const ItemComp = external ? 'a' : Link

                  return (
                    <li key={item.id}>
                      <ItemComp
                        href={item.url}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noopener noreferrer' : undefined}
                        className="group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-black/[0.04] hover:text-slate-900 transition-all duration-200"
                        onClick={() => !external && onClose()}
                      >
                        <span
                          className="shrink-0 transition-transform group-hover:scale-110"
                          style={{ color: item.color || '#0071e3' }}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {external && (
                          <ExternalLink
                            size={12}
                            aria-hidden="true"
                            className="text-slate-400/80 group-hover:text-slate-600"
                          />
                        )}
                      </ItemComp>
                    </li>
                  )
                })}

                {/* Quick Add link pill */}
                <li>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="flex min-h-9 w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
                  >
                    <Plus size={14} className="text-[#0071e3]" />
                    <span>เพิ่มลิงก์ด่วน...</span>
                  </button>
                </li>
              </ul>
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

      {/* Quick Links Manager Dialog */}
      <QuickLinksModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialLinks={links}
        onSave={handleSaveLinks}
      />
    </>
  )
}