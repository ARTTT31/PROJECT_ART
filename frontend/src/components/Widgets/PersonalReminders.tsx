'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, CalendarPlus, Check, Palmtree, Plus, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { readCached, readPending, writeCached, writePending, clearPending } from '@/lib/offline/localStore';

export type ReminderKind = 'errand' | 'leave' | 'other';

export interface PersonalReminder {
  id: string;
  date: string;
  title: string;
  kind: ReminderKind;
  note?: string;
  done: boolean;
}

const CACHE_KEY = 'profile/reminders';

const KIND_META: Record<ReminderKind, { label: string; icon: typeof Briefcase }> = {
  errand: { label: 'ธุระ', icon: Briefcase },
  leave: { label: 'ลาหยุด', icon: Palmtree },
  other: { label: 'อื่น ๆ', icon: CalendarPlus },
};

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortReminders(items: PersonalReminder[]): PersonalReminder[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

function daysUntil(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Personal planner entries: the errands and leave days that are not company
 * holidays. Reads the offline mirror first, keeps edits locally when the
 * connection is down, and replays them when it returns — the same contract the
 * other widgets follow.
 */
export default function PersonalReminders() {
  const [reminders, setReminders] = useState<PersonalReminder[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<ReminderKind>('errand');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const flushing = useRef(false);

  const persist = useCallback(async (next: PersonalReminder[]) => {
    const ordered = sortReminders(next);
    setReminders(ordered);
    writeCached(CACHE_KEY, { reminders: ordered });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      writePending(CACHE_KEY, { reminders: ordered });
      setStatus('ออฟไลน์ · บันทึกในเครื่องแล้ว จะซิงก์เมื่อกลับมาออนไลน์');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/planner/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: ordered }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clearPending(CACHE_KEY);
      setStatus('บันทึกแล้ว');
    } catch {
      writePending(CACHE_KEY, { reminders: ordered });
      setStatus('ยังซิงก์ไม่ได้ · เก็บไว้ในเครื่องแล้ว');
    } finally {
      setSaving(false);
    }
  }, []);

  const load = useCallback(async () => {
    const cached = readCached<{ reminders: PersonalReminder[] }>(CACHE_KEY);
    const pending = readPending<{ reminders: PersonalReminder[] }>(CACHE_KEY);
    if (pending?.data?.reminders) {
      setReminders(sortReminders(pending.data.reminders));
    } else if (cached?.data?.reminders) {
      setReminders(sortReminders(cached.data.reminders));
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    try {
      const res = await fetchWithAuth('/api/v1/planner/reminders');
      if (!res.ok) return;
      const body = (await res.json()) as { reminders?: PersonalReminder[] };
      const fromServer = Array.isArray(body.reminders) ? body.reminders : [];
      // An unsent local edit is newer than what the server still has.
      if (readPending<{ reminders: PersonalReminder[] }>(CACHE_KEY)) return;
      setReminders(sortReminders(fromServer));
      writeCached(CACHE_KEY, { reminders: fromServer });
    } catch {
      // Cached list stays on screen; nothing to report.
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const pending = readPending<{ reminders: PersonalReminder[] }>(CACHE_KEY);
    if (!pending?.data?.reminders) return;
    flushing.current = true;
    try {
      const res = await fetchWithAuth('/api/v1/planner/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: pending.data.reminders }),
      });
      if (res.ok) {
        clearPending(CACHE_KEY);
        setStatus('ซิงก์รายการที่ค้างไว้แล้ว');
      }
    } catch {
      // Still offline: the pending marker stays for the next attempt.
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load, flush]);

  const add = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const entry: PersonalReminder = {
      id: newId(),
      date,
      title: trimmed,
      kind,
      done: false,
    };
    setTitle('');
    setOpen(false);
    await persist([...reminders, entry]);
  };

  const toggle = async (id: string) => {
    await persist(reminders.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const remove = async (id: string) => {
    await persist(reminders.filter((item) => item.id !== id));
  };

  const upcoming = useMemo(
    () => reminders.filter((item) => !item.done && daysUntil(item.date) >= 0).slice(0, 6),
    [reminders],
  );

  return (
    <div className="mt-4 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-[var(--ink)]">
          เตือนของฉัน
          <span className="ml-1.5 font-medium text-[var(--ink-tertiary)]">
            ({reminders.filter((item) => !item.done).length})
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="small-control inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--hairline)] transition-colors hover:bg-[var(--accent-soft)]"
          aria-expanded={open}
        >
          <Plus size={12} aria-hidden="true" />
          เพิ่ม
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add();
            }}
            placeholder="เช่น ไปธนาคาร, ลาพักร้อน"
            aria-label="ชื่อรายการที่ต้องเตือน"
            className="w-full rounded-[11px] border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] outline-hidden focus:border-[var(--accent)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="วันที่"
              className="rounded-[11px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-hidden focus:border-[var(--accent)]"
            />
            <div className="inline-flex rounded-full bg-[var(--surface-chip)] p-0.5" role="group" aria-label="ประเภท">
              {(Object.keys(KIND_META) as ReminderKind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={`small-control rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    kind === value
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {KIND_META[value].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={!title.trim() || saving}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
            >
              <Check size={12} aria-hidden="true" /> บันทึก
            </button>
          </div>
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">
          ยังไม่มีรายการที่ต้องเตือน — เพิ่มธุระหรือวันลาของคุณเองได้
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {upcoming.map((item) => {
            const Icon = KIND_META[item.kind].icon;
            const left = daysUntil(item.date);
            return (
              <li key={item.id} className="flex items-center gap-2 rounded-[11px] px-1.5 py-1">
                <Icon size={12} className="shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)]">
                  {item.title}
                  <span className="ml-1.5 text-[11px] text-[var(--ink-tertiary)]">
                    {KIND_META[item.kind].label}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-[var(--ink-muted)]">
                  {left === 0 ? 'วันนี้' : left === 1 ? 'พรุ่งนี้' : `อีก ${left} วัน`}
                </span>
                <button
                  type="button"
                  onClick={() => void toggle(item.id)}
                  aria-label={`ทำเครื่องหมาย ${item.title} ว่าเสร็จแล้ว`}
                  className="small-control shrink-0 rounded-full p-1 text-[var(--ink-tertiary)] hover:text-[var(--success)]"
                >
                  <Check size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  aria-label={`ลบ ${item.title}`}
                  className="small-control shrink-0 rounded-full p-1 text-[var(--ink-tertiary)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {status && (
        <p role="status" className="mt-1.5 text-[11px] text-[var(--ink-tertiary)]">
          {status}
        </p>
      )}
    </div>
  );
}
