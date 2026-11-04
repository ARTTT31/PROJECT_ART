'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCheck,
  CloudRain,
  Fuel,
  Info,
  Palmtree,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  clearHistory,
  clearHistoryOnServer,
  fetchServerHistory,
  markAllReadOnServer,
  readHistory,
  syncHistoryToServer,
  type ServerNotification,
  type StoredNotification,
} from '@/lib/notifications/history';

const READ_STORAGE_KEY = 'artNotificationReadV2';

const LEVEL_META = {
  info: { label: 'ข้อมูล', className: 'bg-sky-100 text-sky-800', icon: Info },
  warning: { label: 'แจ้งเตือน', className: 'bg-amber-100 text-amber-900', icon: AlertTriangle },
  danger: { label: 'สำคัญ', className: 'bg-rose-100 text-rose-800', icon: ShieldAlert },
} as const;

const TYPE_META = {
  holiday: { label: 'วันหยุด', icon: Palmtree },
  weather: { label: 'สภาพอากาศ', icon: CloudRain },
  oilprice: { label: 'ราคาน้ำมัน', icon: Fuel },
  system: { label: 'ระบบ', icon: Sparkles },
} as const;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fromServer(items: ServerNotification[]): {
  entries: StoredNotification[];
  readIds: Set<string>;
} {
  return {
    entries: items.map((item) => ({
      id: item.client_id,
      type: item.type,
      level: item.level,
      title: item.title,
      body: item.body,
      at: item.at,
    })),
    readIds: new Set(items.filter((item) => item.read).map((item) => item.client_id)),
  };
}

/**
 * Notification archive.
 *
 * The backend copy is authoritative when it answers; the per-account local
 * archive is both the offline fallback and what gets pushed up on first load,
 * so an alert that arrived yesterday survives a reload or a new device.
 */
export default function NotificationsPage() {
  const [entries, setEntries] = useState<StoredNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [source, setSource] = useState<'local' | 'server'>('local');

  const persistRead = useCallback((next: Set<string>) => {
    setReadIds(next);
    try {
      window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // Private mode: the badge just stays for this session.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const local = readHistory();
    setEntries(local);
    try {
      const raw = window.localStorage.getItem(READ_STORAGE_KEY);
      if (raw) setReadIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      setReadIds(new Set());
    }

    (async () => {
      // Push what this device has, then read the merged archive back.
      await syncHistoryToServer(local);
      const server = await fetchServerHistory();
      if (cancelled || server === null) return;
      const mapped = fromServer(server);
      setEntries(mapped.entries);
      setSource('server');
      // Keep a read mark made offline on this device.
      setReadIds((current) => new Set([...current, ...mapped.readIds]));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter === 'unread' ? entries.filter((entry) => !readIds.has(entry.id)) : entries),
    [entries, filter, readIds],
  );

  const unread = entries.filter((entry) => !readIds.has(entry.id)).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Bell size={20} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-[var(--ink)]">
                ประวัติการแจ้งเตือน
              </h1>
              <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)]">
                {entries.length} รายการ · ยังไม่ได้อ่าน {unread} รายการ ·{' '}
                {source === 'server' ? 'ซิงก์กับบัญชีแล้ว' : 'เก็บไว้ในเครื่องนี้'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)]"
            >
              <ArrowLeft size={14} aria-hidden="true" /> กลับแดชบอร์ด
            </Link>
            <button
              type="button"
              onClick={() => {
                const next = new Set(entries.map((entry) => entry.id));
                persistRead(next);
                void markAllReadOnServer();
              }}
              disabled={unread === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-40"
            >
              <CheckCheck size={14} aria-hidden="true" /> อ่านทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                void clearHistoryOnServer();
                setEntries([]);
              }}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-40"
            >
              <Trash2 size={14} aria-hidden="true" /> ล้างประวัติ
            </button>
          </div>
        </div>

        <div
          className="mt-5 inline-flex rounded-full bg-[var(--surface-chip)] p-0.5"
          role="group"
          aria-label="ตัวกรองประวัติ"
        >
          {(['all', 'unread'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all ${
                filter === value
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {value === 'all' ? `ทั้งหมด (${entries.length})` : `ยังไม่อ่าน (${unread})`}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5">
        {visible.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-4 text-center text-[13px] text-[var(--ink-tertiary)]">
            <Bell size={22} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>
              {entries.length === 0
                ? 'ยังไม่มีประวัติการแจ้งเตือน ระบบจะเก็บไว้เมื่อมีการแจ้งเตือนใหม่'
                : 'ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน'}
            </span>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((entry) => {
              const level = LEVEL_META[entry.level];
              const type = TYPE_META[entry.type];
              const LevelIcon = level.icon;
              const TypeIcon = type.icon;
              const isUnread = !readIds.has(entry.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnread) return;
                      const next = new Set(readIds);
                      next.add(entry.id);
                      persistRead(next);
                    }}
                    className={`flex w-full items-start gap-3 rounded-[14px] p-3.5 text-left transition-colors ${
                      isUnread
                        ? 'bg-[var(--surface-subtle)] ring-1 ring-black/[0.04]'
                        : 'bg-[var(--surface-subtle)] opacity-70'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${level.className}`}
                    >
                      <LevelIcon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-black/[0.04]">
                          <TypeIcon size={11} aria-hidden="true" />
                          {type.label}
                        </span>
                        {isUnread && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                            ใหม่
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--ink-tertiary)]">
                          {formatTime(entry.at)}
                        </span>
                      </span>
                      <span className="mt-1 block text-[13px] font-bold leading-snug text-[var(--ink)]">
                        {entry.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ink-muted)]">
                        {entry.body}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
