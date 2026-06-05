import Link from 'next/link';
import { Home, LogIn, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_22px_42px_rgba(15,23,42,0.12)] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(145deg,#0f4c81_0%,#1675b9_38%,#4f8edb_68%,#6aa7e8_100%)] p-8 text-white sm:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.36),transparent_28%),radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.5),transparent_34%),linear-gradient(180deg,transparent,rgba(8,47,73,0.18))]" />
            <div className="relative flex h-full min-h-[260px] flex-col justify-between">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/24 bg-white/18">
                <SearchX size={32} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[96px] font-extrabold leading-none tracking-normal sm:text-[118px]">404</p>
                <p className="mt-4 max-w-sm text-xl font-semibold leading-8 text-white/86">
                  ไม่พบหน้าที่คุณต้องการ
                </p>
              </div>
            </div>
          </div>

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
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 px-5 text-sm font-bold text-white transition hover:brightness-105"
              >
                <Home size={18} aria-hidden="true" />
                กลับหน้า Dashboard
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <LogIn size={18} aria-hidden="true" />
                ไปหน้า Login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
