'use client'

/**
 * /apple-style — Standalone Apple-inspired product showcase page.
 *
 * DESIGN EXCEPTION: This isolated test page intentionally overrides the ART
 * Workspace dashboard constraints (rounded-xl cap, slate palette density) to
 * study Apple's product-showcase aesthetic. It shares no components with the
 * dashboard and does not affect other pages.
 *
 * Apple showcase DNA applied:
 *  - Pure #ffffff body + #f5f5f7 section alternation
 *  - Bento tiles: rounded-[28px]–rounded-[40px], no borders, depth via bg only
 *  - Typography IS the layout: oversized headings carry composition weight
 *  - Tiles use saturated color-field backgrounds as identity, not accent stripes
 *  - Sticky translucent nav: Apple's exact bg-white/80 + backdrop-blur-xl
 *  - No hero-metric template, no identical card grid, no eyebrow on every section
 */

import { useState } from 'react'
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronRight,
  Cloud,
  Cpu,
  FileText,
  Flame,
  Layers,
  MessageSquare,
  Settings,
  Shield,
  Users,
  Zap,
} from 'lucide-react'


// ─── Sticky Nav ────────────────────────────────────────────────────────────

function AppleNav() {
  const [active, setActive] = useState('ภาพรวม')
  const items = ['ภาพรวม', 'ฟีเจอร์', 'ความปลอดภัย', 'ทีมงาน']

  return (
    <header className="sticky top-0 z-[100] border-b border-black/[0.08] bg-[rgba(255,255,255,0.82)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[52px] max-w-[1024px] items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Layers className="h-[18px] w-[18px] text-[#1d1d1f]" aria-hidden="true" />
          <span
            className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]"
            style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
          >
            ART Workspace
          </span>
        </div>

        <nav aria-label="เมนูหลัก">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item}>
                <button
                  onClick={() => setActive(item)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 ${
                    active === item
                      ? 'bg-[#1d1d1f] text-white'
                      : 'text-[#424245] hover:bg-black/[0.06] hover:text-[#1d1d1f]'
                  }`}
                  aria-current={active === item ? 'page' : undefined}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#424245] transition-colors duration-150 hover:bg-black/[0.06] hover:text-[#1d1d1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label="การแจ้งเตือน"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#424245] transition-colors duration-150 hover:bg-black/[0.06] hover:text-[#1d1d1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label="ตั้งค่า"
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3] text-[13px] font-bold text-white" aria-label="บัญชีผู้ใช้">
            ส
          </div>
        </div>
      </div>
    </header>
  )
}


// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-white px-6 pb-20 pt-24 text-center">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] px-4 py-1.5">
          <Zap className="h-3.5 w-3.5 text-[#0071e3]" aria-hidden="true" />
          <span
            className="text-[13px] font-semibold text-[#0071e3]"
            style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
          >
            ระบบพร้อมใช้งาน 99.8%
          </span>
        </div>

        <h1
          className="text-balance text-[56px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#1d1d1f] sm:text-[68px]"
          style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
        >
          ทำงานได้มากขึ้น
          <br />
          <span className="text-[#6e6e73]">ในที่เดียว</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-[480px] text-[19px] leading-[1.6] text-[#6e6e73]"
          style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
        >
          ART Workspace รวมปฏิทิน, รายงาน, ราคาน้ำมัน และเครื่องมือทีมงาน ไว้ในแดชบอร์ดเดียว
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-7 py-3 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_4px_20px_rgba(0,113,227,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
            style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
          >
            เริ่มต้นใช้งาน
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-7 py-3 text-[17px] font-semibold text-[#0071e3] transition-all duration-200 hover:bg-[#f5f5f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2"
            style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
          >
            ดูฟีเจอร์ <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}


// ─── Bento Feature Grid ─────────────────────────────────────────────────────

function BentoGrid() {
  return (
    <section className="bg-[#f5f5f7] px-6 py-28">
      <div className="mx-auto max-w-[1024px]">
        {/* Grid row 1: large + small */}
        <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Calendar tile — spans 8 cols */}
          <div className="flex flex-col justify-end overflow-hidden rounded-[32px] bg-gradient-to-br from-[#4776e6] to-[#8e54e9] p-10 lg:col-span-8 lg:min-h-[420px]">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/20 backdrop-blur-md">
              <Calendar className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
            <h2
              className="mb-3 text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white lg:text-[48px]"
              style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
            >
              ปฏิทินกิจกรรม
            </h2>
            <p
              className="max-w-[420px] text-[19px] leading-relaxed text-white/90"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              เชื่อมต่อกับ Google Calendar พร้อมสรุปกิจกรรมสำคัญทั้งหมดในมุมมองเดียว
            </p>
            <button
              className="mt-6 inline-flex w-fit items-center gap-1.5 text-[17px] font-semibold text-white transition-transform duration-150 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#4776e6]"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              เรียนรู้เพิ่มเติม <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Oil price tile — spans 4 cols */}
          <div className="flex flex-col justify-end overflow-hidden rounded-[32px] bg-gradient-to-br from-[#f09819] to-[#ff512f] p-8 lg:col-span-4 lg:min-h-[420px]">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[16px] bg-white/20 backdrop-blur-md">
              <Flame className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <h3
              className="mb-2 text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-white"
              style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
            >
              ราคาน้ำมัน
            </h3>
            <p
              className="text-[17px] leading-relaxed text-white/90"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              อัปเดตอัตโนมัติทุกวัน
            </p>
          </div>
        </div>

        {/* Grid row 2: three equal tiles */}
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Team tile */}
          <div className="flex flex-col justify-end overflow-hidden rounded-[32px] bg-[#1d1d1f] p-8 sm:min-h-[340px]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/10 backdrop-blur-md">
              <Users className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <h3
              className="mb-2 text-[28px] font-extrabold leading-tight tracking-[-0.015em] text-white"
              style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
            >
              การจัดการทีม
            </h3>
            <p
              className="text-[15px] leading-relaxed text-white/70"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              เพิ่มสมาชิก กำหนดสิทธิ์ และติดตามกิจกรรมทีม
            </p>
          </div>

          {/* Messages tile */}
          <div className="flex flex-col justify-end overflow-hidden rounded-[32px] bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 sm:min-h-[340px]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/20 backdrop-blur-md">
              <MessageSquare className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <h3
              className="mb-2 text-[28px] font-extrabold leading-tight tracking-[-0.015em] text-white"
              style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
            >
              ศูนย์ข้อความ
            </h3>
            <p
              className="text-[15px] leading-relaxed text-white/90"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              รับส่งข้อความและแจ้งเตือนภายในทีม
            </p>
          </div>

          {/* Docs tile */}
          <div className="flex flex-col justify-end overflow-hidden rounded-[32px] bg-white p-8 ring-1 ring-black/[0.06] sm:min-h-[340px]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f5f5f7]">
              <FileText className="h-6 w-6 text-[#1d1d1f]" aria-hidden="true" />
            </div>
            <h3
              className="mb-2 text-[28px] font-extrabold leading-tight tracking-[-0.015em] text-[#1d1d1f]"
              style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
            >
              คลังเอกสาร
            </h3>
            <p
              className="text-[15px] leading-relaxed text-[#6e6e73]"
              style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
            >
              จัดเก็บและค้นหาเอกสารสำคัญ
            </p>
          </div>
        </div>


        {/* Grid row 3: system gauges + CPU */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Storage + shield tile — wider */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0575e6] to-[#021b79] p-8 sm:min-h-[320px]">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/20 backdrop-blur-md">
                <Shield className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <h3
                className="mb-2 text-[28px] font-extrabold leading-tight tracking-[-0.015em] text-white"
                style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
              >
                ความปลอดภัย
              </h3>
              <p
                className="text-[15px] leading-relaxed text-white/90"
                style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
              >
                เข้ารหัสข้อมูล และสำรองอัตโนมัติ
              </p>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-end justify-between">
                <span className="text-[36px] font-bold tracking-tight text-white">68%</span>
                <span className="text-[13px] font-semibold text-white/70">136 / 200 GB</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-[68%] rounded-full bg-white" role="progressbar" aria-valuenow={68} aria-valuemin={0} aria-valuemax={100} />
              </div>
            </div>
          </div>

          {/* CPU tile */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[32px] bg-white p-8 ring-1 ring-black/[0.06] sm:min-h-[320px]">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f5f5f7]">
                <Cpu className="h-6 w-6 text-[#1d1d1f]" aria-hidden="true" />
              </div>
              <h3
                className="mb-2 text-[28px] font-extrabold leading-tight tracking-[-0.015em] text-[#1d1d1f]"
                style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
              >
                ประสิทธิภาพ
              </h3>
              <p
                className="text-[15px] leading-relaxed text-[#6e6e73]"
                style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
              >
                ระบบทำงานปกติ
              </p>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-end justify-between">
                <span className="text-[36px] font-bold tracking-tight text-[#1d1d1f]">23%</span>
                <span className="inline-flex rounded-full bg-[#34c759]/10 px-2.5 py-1 text-[11px] font-bold text-[#34c759]">CPU</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#f5f5f7]">
                <div className="h-full w-[23%] rounded-full bg-[#34c759]" role="progressbar" aria-valuenow={23} aria-valuemin={0} aria-valuemax={100} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


// ─── Closing CTA Section ─────────────────────────────────────────────────────

function ClosingCTA() {
  return (
    <section className="bg-white px-6 py-32 text-center">
      <div className="mx-auto max-w-[680px]">
        <h2
          className="text-balance text-[48px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#1d1d1f] sm:text-[56px]"
          style={{ fontFamily: 'Anuphan, SF Pro Display, Inter, system-ui, sans-serif' }}
        >
          เริ่มใช้ ART Workspace
          <br />
          <span className="text-[#6e6e73]">วันนี้</span>
        </h2>

        <p
          className="mx-auto mt-6 max-w-[480px] text-[19px] leading-[1.6] text-[#6e6e73]"
          style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
        >
          ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต
        </p>

        <button
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-8 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_4px_20px_rgba(0,113,227,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
          style={{ fontFamily: 'Anuphan, Inter, system-ui, sans-serif' }}
        >
          สร้างบัญชีฟรี
        </button>
      </div>
    </section>
  )
}

// ─── Page Root ───────────────────────────────────────────────────────────────

export default function AppleStylePage() {
  return (
    <>
      <AppleNav />
      <main>
        <Hero />
        <BentoGrid />
        <ClosingCTA />
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
    </>
  )
}
