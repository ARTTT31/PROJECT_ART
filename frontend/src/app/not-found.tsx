'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Home, LogIn, SearchX, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-[100dvh] text-slate-950" style={{ background: 'var(--art-page-bg)' }}>
      <a href="#main-content" className="skip-link">
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <div id="main-content" className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
        <section
          className={`w-full max-w-5xl overflow-hidden rounded-[var(--art-radius-xl)] border border-white/30 bg-white/70 backdrop-blur-[24px] shadow-glass-xl transition-all duration-700 ease-out lg:grid lg:grid-cols-[0.92fr_1.08fr] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          role="alert"
          aria-live="polite"
        >
          {/* Left: Visual Panel */}
          <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(145deg,#0f4c81_0%,#1675b9_38%,#4f8edb_68%,#6aa7e8_100%)] p-8 text-white sm:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.36),transparent_28%),radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.5),transparent_34%),linear-gradient(180deg,transparent,rgba(8,47,73,0.18))]" aria-hidden="true" />
            <div className="relative flex h-full min-h-[260px] flex-col justify-between">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/24 bg-white/18">
                <SearchX size={32} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[clamp(4rem,10vw,6rem)] font-extrabold leading-none tracking-normal" aria-label="404">
                  404
                </p>
                <p className="mt-4 max-w-sm text-xl font-semibold leading-8 text-white/86">
                  ไม่พบหน้าที่คุณต้องการ
                </p>
              </div>
            </div>
          </div>

          {/* Right: Content Panel */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="text-sm font-bold text-sky-700">ART Workspace</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-normal text-slate-950">
              ลิงก์นี้อาจถูกย้าย หรือลบออกแล้ว
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              กลับไปยังหน้าหลักของระบบ หรือเข้าสู่ระบบอีกครั้งเพื่อไปยังแดชบอร์ดของคุณ
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="art-primary-button inline-flex items-center justify-center gap-2 !rounded-2xl"
              >
                <Home size={18} aria-hidden="true" />
                กลับหน้า Dashboard
              </Link>
              <Link
                href="/login"
                className="art-soft-button inline-flex items-center justify-center gap-2 !rounded-2xl"
              >
                <LogIn size={18} aria-hidden="true" />
                ไปหน้า Login
              </Link>
            </div>

            <button
              onClick={() => typeof window !== 'undefined' && window.history.back()}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              กลับหน้าที่แล้ว
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
