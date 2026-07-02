'use client'

import { useState } from 'react'
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  FileText,
  Flame,
  Layers,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  delta: string
  positive: boolean
  icon: React.ReactNode
}

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  accent: string
  tag?: string
}

interface TaskItem {
  id: number
  title: string
  done: boolean
  priority: 'สูง' | 'กลาง' | 'ต่ำ'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, delta, positive, icon }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100 transition-colors duration-200 group-hover:bg-sky-50 group-hover:text-sky-600 group-hover:ring-sky-100">
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            positive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-600'
          }`}
        >
          {positive ? '↑' : '↓'} {delta}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-500">{label}</div>
    </div>
  )
}

function FeatureCard({ icon, title, description, accent, tag }: FeatureCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      {tag && (
        <span className="absolute right-4 top-4 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">
          {tag}
        </span>
      )}
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white transition-transform duration-200 group-hover:scale-105 ${accent}`}
      >
        {icon}
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="flex-1 text-sm leading-relaxed text-slate-500">{description}</p>
      <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-sky-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        ดูเพิ่มเติม <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

const INITIAL_TASKS: TaskItem[] = [
  { id: 1, title: 'ตรวจสอบรายงานประจำวัน', done: true, priority: 'สูง' },
  { id: 2, title: 'อัปเดตข้อมูลราคาน้ำมัน', done: false, priority: 'กลาง' },
  { id: 3, title: 'ส่งสรุปผลการประชุม', done: false, priority: 'สูง' },
  { id: 4, title: 'เพิ่มผู้ใช้งานในระบบ', done: false, priority: 'ต่ำ' },
  { id: 5, title: 'สำรองข้อมูลระบบ', done: true, priority: 'กลาง' },
]

const PRIORITY_STYLES: Record<TaskItem['priority'], string> = {
  สูง: 'bg-rose-50 text-rose-600',
  กลาง: 'bg-amber-50 text-amber-600',
  ต่ำ: 'bg-slate-100 text-slate-500',
}

function TaskChecklist() {
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS)

  const toggle = (id: number) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    )

  const done = tasks.filter((t) => t.done).length
  const pct = Math.round((done / tasks.length) * 100)

  return (
    <div className="flex h-full flex-col">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-500">ความคืบหน้า</span>
          <span className="text-[13px] font-bold text-slate-700">{done}/{tasks.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              onClick={() => toggle(task.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${
                task.done ? 'opacity-60' : ''
              }`}
              aria-pressed={task.done}
            >
              <CheckCircle2
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
                  task.done ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-400'
                }`}
                aria-hidden="true"
              />
              <span
                className={`flex-1 text-sm font-medium text-slate-700 ${
                  task.done ? 'line-through' : ''
                }`}
              >
                {task.title}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLES[task.priority]}`}>
                {task.priority}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityFeed() {
  const items = [
    { icon: <Users className="h-3.5 w-3.5" />, text: 'สมชาย เพิ่มผู้ใช้ใหม่ 3 คน', time: '2 นาทีที่แล้ว', color: 'bg-sky-100 text-sky-700' },
    { icon: <FileText className="h-3.5 w-3.5" />, text: 'ระบบสร้างรายงานประจำวันแล้ว', time: '15 นาทีที่แล้ว', color: 'bg-violet-100 text-violet-700' },
    { icon: <Shield className="h-3.5 w-3.5" />, text: 'ตรวจสอบความปลอดภัยสำเร็จ', time: '1 ชั่วโมงที่แล้ว', color: 'bg-emerald-100 text-emerald-700' },
    { icon: <Bell className="h-3.5 w-3.5" />, text: 'ส่งการแจ้งเตือนทีมงานแล้ว', time: '3 ชั่วโมงที่แล้ว', color: 'bg-amber-100 text-amber-700' },
  ]

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-slate-50">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.color}`}>
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">{item.text}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {item.time}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AppleStylePage() {
  const [activeNav, setActiveNav] = useState('ภาพรวม')

  const navItems = ['ภาพรวม', 'วิเคราะห์', 'รายงาน', 'ทีมงาน', 'ตั้งค่า']

  return (
    <div className="min-h-screen bg-[#f6f8fb] font-[Anuphan,Inter,system-ui,sans-serif]">
      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-[100] border-b border-slate-200/60 bg-white/80 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500">
              <Layers className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-900">ART Workspace</span>
          </div>

          {/* Nav tabs */}
          <nav aria-label="เมนูหลัก">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item}>
                  <button
                    onClick={() => setActiveNav(item)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${
                      activeNav === item
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    aria-current={activeNav === item ? 'page' : undefined}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="การแจ้งเตือน"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="ตั้งค่า"
            >
              <Settings className="h-4 w-4" />
            </button>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white"
              aria-label="บัญชีผู้ใช้: สมชาย"
            >
              ส
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">

        {/* Page heading */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-sky-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            วันพุธ, 2 กรกฎาคม 2569
          </div>
          <h1 className="text-balance text-[1.75rem] font-bold tracking-tight text-slate-900">
            สวัสดี, สมชาย — ระบบทำงานปกติทุกส่วน
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-base leading-relaxed text-slate-500">
            มีงาน 3 รายการที่รอดำเนินการ และรายงานประจำวันพร้อมแล้ว
          </p>
        </div>

        {/* ── Row 1: Stat cards (4 equal columns) ─────────────────────────── */}
        <section aria-label="สถิติสรุป" className="mb-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="ผู้ใช้งานทั้งหมด"
              value="1,284"
              delta="12%"
              positive={true}
            />
            <StatCard
              icon={<FileText className="h-4 w-4" />}
              label="รายงานวันนี้"
              value="47"
              delta="5%"
              positive={true}
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="งานที่เสร็จแล้ว"
              value="93%"
              delta="2%"
              positive={false}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="ประสิทธิภาพระบบ"
              value="99.8%"
              delta="0.1%"
              positive={true}
            />
          </div>
        </section>

        {/* ── Row 2: Bento grid — main content ────────────────────────────── */}
        <section aria-label="พื้นที่ทำงานหลัก" className="mb-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

            {/* Task checklist — spans 5 cols */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] lg:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-bold tracking-tight text-slate-900">รายการงาน</h2>
                <button
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors duration-150 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="เพิ่มงานใหม่"
                >
                  + เพิ่มงาน
                </button>
              </div>
              <TaskChecklist />
            </div>

            {/* Activity feed — spans 4 cols */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] lg:col-span-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-bold tracking-tight text-slate-900">กิจกรรมล่าสุด</h2>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">4</span>
              </div>
              <ActivityFeed />
            </div>

            {/* System status — spans 3 cols */}
            <div className="flex flex-col gap-3 lg:col-span-3">
              {/* Storage */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                <div className="mb-2 flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-slate-700">พื้นที่จัดเก็บ</span>
                </div>
                <div className="mb-1 flex items-end justify-between">
                  <span className="text-xl font-bold tracking-tight text-slate-900">68%</span>
                  <span className="text-xs text-slate-400">136 / 200 GB</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full w-[68%] rounded-full bg-sky-500"
                    role="progressbar"
                    aria-valuenow={68}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="ใช้พื้นที่ 68%"
                  />
                </div>
              </div>

              {/* CPU */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                <div className="mb-2 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-slate-700">การใช้งาน CPU</span>
                </div>
                <div className="mb-1 flex items-end justify-between">
                  <span className="text-xl font-bold tracking-tight text-slate-900">23%</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">ปกติ</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full w-[23%] rounded-full bg-emerald-500"
                    role="progressbar"
                    aria-valuenow={23}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="CPU ใช้งาน 23%"
                  />
                </div>
              </div>

              {/* Active users */}
              <div className="flex-1 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                <div className="mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-slate-700">ผู้ใช้ออนไลน์</span>
                </div>
                <div className="text-xl font-bold tracking-tight text-slate-900">24</div>
                <div className="mt-2 flex -space-x-1.5">
                  {['ส', 'ว', 'ป', 'น', 'ก'].map((initial, i) => (
                    <div
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-[11px] font-bold text-white"
                      aria-label={`ผู้ใช้ ${initial}`}
                    >
                      {initial}
                    </div>
                  ))}
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500">
                    +19
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Row 3: Feature cards (varied-width bento) ───────────────────── */}
        <section aria-label="ฟีเจอร์ระบบ">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">เครื่องมือและฟีเจอร์</h2>
            <button className="text-sm font-semibold text-sky-600 transition-colors duration-150 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
              ดูทั้งหมด
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Calendar className="h-5 w-5" />}
              accent="bg-sky-500"
              title="ปฏิทินกิจกรรม"
              description="ติดตามนัดหมายและกิจกรรมสำคัญของทีมในมุมมองรายวัน รายสัปดาห์ และรายเดือน"
              tag="ใหม่"
            />
            <FeatureCard
              icon={<Flame className="h-5 w-5" />}
              accent="bg-amber-500"
              title="ราคาน้ำมัน"
              description="ข้อมูลราคาน้ำมันประเภทต่าง ๆ อัปเดตอัตโนมัติทุกวัน พร้อมกราฟแนวโน้ม"
            />
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              accent="bg-violet-500"
              title="ศูนย์ข้อความ"
              description="รับส่งข้อความภายในทีมและแจ้งเตือนงานสำคัญโดยตรงถึงสมาชิก"
            />
            <FeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              accent="bg-teal-500"
              title="คลังเอกสาร"
              description="จัดเก็บและค้นหาเอกสารสำคัญ พร้อมระบบสิทธิ์การเข้าถึงตามบทบาท"
            />
          </div>
        </section>
      </main>

      {/* Reduced-motion override */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition-duration: 1ms !important;
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  )
}
