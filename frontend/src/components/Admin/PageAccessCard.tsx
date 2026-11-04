'use client';

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Lock, PanelsTopLeft, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  DEFAULT_PAGE_SWITCHES,
  refreshPageSwitches,
  type PageSwitch,
} from '@/hooks/useEnabledPages';

/**
 * Workspace-wide page switches.
 *
 * This is the single place an admin opens or closes a page for everybody. The
 * admin console and the activity log are admin-only, so they appear here as a
 * fixed badge rather than a switch — closing them would not change anything for
 * a member, and hiding the console from the admin would strand the console.
 */
export default function PageAccessCard() {
  const [pages, setPages] = useState<PageSwitch[]>(DEFAULT_PAGE_SWITCHES);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth('/api/v1/system/pages');
        if (!res.ok) return;
        const body = (await res.json()) as { pages?: PageSwitch[] };
        if (!cancelled && Array.isArray(body.pages)) setPages(body.pages);
      } catch {
        // The defaults above keep the card usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    setPages((current) =>
      current.map((page) =>
        page.id === id && !page.required && !page.adminOnly
          ? { ...page, enabled: !page.enabled }
          : page,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const enabled = pages.filter((page) => page.enabled).map((page) => page.id);
      const res = await fetchWithAuth('/api/v1/system/pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { pages?: PageSwitch[] };
      if (Array.isArray(body.pages)) setPages(body.pages);
      await refreshPageSwitches();
      const closed = pages.filter(
        (page) => !page.enabled && !page.required && !page.adminOnly,
      ).length;
      setMessage({
        tone: 'ok',
        text:
          closed > 0
            ? `บันทึกแล้ว · ปิด ${closed} หน้า — ผู้ใช้จะเห็นผลเมื่อโหลดหน้าใหม่`
            : 'บันทึกแล้ว · ทุกหน้าเปิดใช้งาน',
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <PanelsTopLeft size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
              เปิด/ปิดหน้าใช้งาน
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              มีผลกับทุกคนใน workspace พร้อมกัน — ปิดหน้าที่ไม่ต้องการให้เห็นในเมนู
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12.5px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Check size={14} aria-hidden="true" />
          )}
          บันทึก
        </button>
      </div>

      <div className="divide-y divide-[var(--hairline-soft)]">
        {pages.map((page) => {
          const locked = page.required;
          return (
            <div key={page.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
                  page.enabled
                    ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                    : 'bg-[var(--surface-grouped-2)] text-[var(--ink-tertiary)]'
                }`}
              >
                {page.enabled ? (
                  <Eye size={15} aria-hidden="true" />
                ) : (
                  <EyeOff size={15} aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--ink)]">{page.label}</p>
                <p className="text-[11.5px] text-[var(--ink-tertiary)]">
                  {page.adminOnly
                    ? 'เห็นเฉพาะบัญชีแอดมิน — ปิดไม่ได้'
                    : locked
                      ? 'เปิดถาวร — ปิดไม่ได้เพื่อไม่ให้ผู้ใช้ติดค้าง'
                      : page.enabled
                        ? 'ทุกคนที่ได้รับสิทธิ์เห็นหน้านี้'
                        : 'ซ่อนจากทุกคนใน workspace'}
                </p>
              </div>

              {page.adminOnly ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--accent-text)]">
                  <ShieldCheck size={11} aria-hidden="true" /> เฉพาะแอดมิน
                </span>
              ) : locked ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-grouped-2)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--ink-tertiary)]">
                  <Lock size={11} aria-hidden="true" /> จำเป็น
                </span>
              ) : (
                // `small-control` opts out of the global button min-height rule in
                // globals.css, which would otherwise stretch the track into a circle.
                <button
                  type="button"
                  role="switch"
                  aria-checked={page.enabled}
                  onClick={() => toggle(page.id)}
                  aria-label={`${page.enabled ? 'ปิด' : 'เปิด'}หน้า ${page.label}`}
                  className={`small-control relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                    page.enabled ? 'bg-[var(--success)]' : 'bg-[var(--surface-chip-2)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out"
                    style={{ transform: page.enabled ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <div
          role="status"
          className={`border-t px-5 py-2.5 text-[12px] sm:px-6 ${
            message.tone === 'ok'
              ? 'border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-ink)]'
              : 'border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-ink)]'
          }`}
        >
          {message.text}
        </div>
      )}
    </section>
  );
}
