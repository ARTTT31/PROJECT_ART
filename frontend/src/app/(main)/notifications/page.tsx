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
import { showDeleteConfirm } from '@/utils/sweetalert';
import { PageHeader } from '@/components/ui/PageHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
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
  info: {
    label: 'ข้อมูล',
    className: 'bg-[var(--accent-soft)] text-[var(--accent-text)]',
    icon: Info,
  },
  warning: {
    label: 'แจ้งเตือน',
    className: 'bg-[var(--warning-soft)] text-[var(--warning-ink)]',
    icon: AlertTriangle,
  },
  danger: {
    label: 'สำคัญ',
    className: 'bg-[var(--danger-soft)] text-[var(--danger-ink)]',
    icon: ShieldAlert,
  },
} as const;

const TYPE_META = {
  holiday: { label: 'วันหยุด', icon: Palmtree },
  weather: { label: 'สภาพอากาศ', icon: CloudRain },
  oilprice: { label: 'ราคาน้ำมัน', icon: Fuel },
  system: { label: 'ระบบ', icon: Sparkles },
} as const;

const FALLBACK_TYPE = { label: 'ทั่วไป', icon: Bell };

function levelOf(level: string) {
  return LEVEL_META[level as keyof typeof LEVEL_META] ?? LEVEL_META.info;
}

function typeOf(type: string) {
  return TYPE_META[type as keyof typeof TYPE_META] ?? FALLBACK_TYPE;
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function timeOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
}

function fullTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${dateFormatter.format(date)} · ${timeOnly(value)}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Day bucket for an entry: "วันนี้" / "เมื่อวาน" / a full date.
 *
 * A flat list of everything ever received is unreadable on a phone; grouping by
 * day and putting the newest group first is what makes "what happened while I was
 * away" answerable at a glance.
 */
function dayGroupOf(value: string, todayStart: number): { key: string; label: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { key: 'unknown', label: 'ไม่ทราบวันที่' };

  const start = startOfDay(date);
  if (start === todayStart) return { key: 'today', label: 'วันนี้' };
  if (start === todayStart - 86_400_000) return { key: 'yesterday', label: 'เมื่อวาน' };
  return { key: `d-${start}`, label: dateFormatter.format(date) };
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

  const unread = entries.filter((entry) => !readIds.has(entry.id)).length;

  const visible = useMemo(() => {
    const filtered = filter === 'unread' ? entries.filter((entry) => !readIds.has(entry.id)) : entries;
    // Newest first, always: the archive arrives in server order, and the local
    // copy can be appended in any order across sessions.
    return [...filtered].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [entries, filter, readIds]);

  const groups = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const buckets: { key: string; label: string; items: StoredNotification[] }[] = [];
    for (const entry of visible) {
      const group = dayGroupOf(entry.at, todayStart);
      const last = buckets[buckets.length - 1];
      if (last && last.key === group.key) {
        last.items.push(entry);
      } else {
        buckets.push({ ...group, items: [entry] });
      }
    }
    return buckets;
  }, [visible]);

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    persistRead(next);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Bell size={20} aria-hidden="true" />}
        title="ประวัติการแจ้งเตือน"
        subtitle={
          <>
            {entries.length} รายการ
            {unread > 0 ? ` · ยังไม่ได้อ่าน ${unread}` : ' · อ่านครบแล้ว'} ·{' '}
            {source === 'server' ? 'ซิงก์กับบัญชีแล้ว' : 'เก็บไว้ในเครื่องนี้'}
          </>
        }
        actions={
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-chip)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
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
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-text)] transition-colors duration-150 hover:bg-[var(--accent)] hover:text-[var(--surface)] disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
            >
              <CheckCheck size={14} aria-hidden="true" /> อ่านทั้งหมด
            </button>
            <button
              type="button"
              onClick={async () => {
                // Clearing also deletes the server-side archive, so there is
                // nothing left to undo: ask first.
                const result = await showDeleteConfirm(
                  'ล้างประวัติการแจ้งเตือนทั้งหมด?',
                  'ประวัติจะถูกลบทั้งในเครื่องนี้และบนบัญชีของคุณ และกู้คืนไม่ได้',
                );
                if (!result.isConfirmed) return;
                clearHistory();
                void clearHistoryOnServer();
                setEntries([]);
                setReadIds(new Set());
              }}
              disabled={entries.length === 0}
              aria-label="ล้างประวัติการแจ้งเตือน"
              title="ล้างประวัติการแจ้งเตือน"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-[var(--danger)] transition-colors duration-150 hover:bg-[var(--danger-soft)] disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2 active:scale-[0.95]"
            >
              <Trash2 size={14} aria-hidden="true" /> ล้างประวัติ
            </button>
          </>
        }
      >
        <SegmentedControl
          label="ตัวกรองประวัติ"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `ทั้งหมด (${entries.length})` },
            { value: 'unread', label: `ยังไม่อ่าน (${unread})` },
          ]}
        />
      </PageHeader>

      {visible.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-apple-lg border border-dashed border-[var(--hairline)] bg-[var(--surface)] px-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--ink-faint)]">
            <Bell size={20} aria-hidden="true" />
          </span>
          <p className="text-[13px] font-semibold text-[var(--ink-secondary)]">
            {entries.length === 0 ? 'ยังไม่มีการแจ้งเตือน' : 'ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน'}
          </p>
          <p className="max-w-[42ch] text-[12px] leading-relaxed text-[var(--ink-tertiary)]">
            {entries.length === 0
              ? 'ระบบจะเก็บการแจ้งเตือนใหม่ไว้ที่นี่ พร้อมซิงก์กับบัญชีของคุณ'
              : 'เปลี่ยนตัวกรองเป็น “ทั้งหมด” เพื่อดูรายการที่อ่านแล้ว'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="text-[13px] font-bold tracking-tight text-[var(--ink-secondary)]">
                {group.label}
              </h2>
              <span className="tabular-nums text-[11px] font-semibold text-[var(--ink-tertiary)]">
                {group.items.length} รายการ
              </span>
            </div>

            {/* Inset grouped list: rows share one surface and one hairline
                divider, the way an iOS Settings list is built. */}
            <ul className="overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] divide-y divide-[var(--hairline)]">
              {group.items.map((entry) => {
                const level = levelOf(entry.level);
                const type = typeOf(entry.type);
                const LevelIcon = level.icon;
                const TypeIcon = type.icon;
                const isUnread = !readIds.has(entry.id);
                const isToday = group.key === 'today';

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => markRead(entry.id)}
                      aria-label={`${entry.title}${isUnread ? ' (ยังไม่ได้อ่าน)' : ''}`}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
                        isUnread ? 'bg-[var(--accent-soft-weak)]' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md ${level.className}`}
                      >
                        <LevelIcon size={16} aria-hidden="true" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={`min-w-0 flex-1 text-[13.5px] leading-snug ${
                              isUnread
                                ? 'font-bold text-[var(--ink)]'
                                : 'font-semibold text-[var(--ink-secondary)]'
                            }`}
                          >
                            {entry.title}
                          </span>
                          <span className="shrink-0 tabular-nums text-[11px] text-[var(--ink-tertiary)]">
                            {isToday ? timeOnly(entry.at) : fullTime(entry.at)}
                          </span>
                        </span>

                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-[var(--ink-muted)]">
                          {entry.body}
                        </span>

                        <span className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${level.className}`}
                          >
                            <LevelIcon size={10} aria-hidden="true" />
                            {level.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--ink-tertiary)]">
                            <TypeIcon size={11} aria-hidden="true" />
                            {type.label}
                          </span>
                        </span>
                      </span>

                      <span
                        aria-hidden="true"
                        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                          isUnread ? 'bg-[var(--accent)]' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
