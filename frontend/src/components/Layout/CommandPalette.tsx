'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  CornerDownLeft,
  FileText,
  Loader2,
  Search,
  Shield,
  StickyNote,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { readCached } from '@/lib/offline/localStore';
import { DEFAULT_MAIN_MENU_ITEMS, MAIN_MENU_ICON_MAP } from '@/utils/mainMenu';

/** Open the palette from anywhere (the header button dispatches this). */
export const COMMAND_PALETTE_EVENT = 'art:command-palette';

export function openCommandPalette() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

type ResultKind = 'page' | 'note' | 'watchlist' | 'reminder' | 'user';

interface CommandResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href?: string;
  icon: React.ReactNode;
  /** Extra words that should match but are not shown. */
  keywords?: string;
}

const KIND_LABEL: Record<ResultKind, string> = {
  page: 'หน้า',
  note: 'โน้ต',
  watchlist: 'ติดตาม',
  reminder: 'เตือน',
  user: 'ผู้ใช้',
};

/** Profile sections that exist today; the settings tab is the deep link. */
const PROFILE_ACTIONS: CommandResult[] = [
  {
    id: 'profile-settings',
    kind: 'page',
    title: 'ตั้งค่าโปรไฟล์',
    subtitle: 'ธีม สี ลิงก์ด่วน และเมนูหลัก',
    href: '/profile?tab=preferences',
    icon: <Shield size={15} aria-hidden="true" />,
    keywords: 'profile settings theme preferences ธีม ตั้งค่า',
  },
];

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Read the offline mirrors so the palette works with no connection.
 *
 * The widgets store the exact API payload, and the shapes differ per widget
 * (`{notes}`, `{items}`, a bare array), so each reader tolerates all of them
 * rather than throwing away a payload it did not expect.
 */
function collectLocalResults(): CommandResult[] {
  const results: CommandResult[] = [];

  const notesCache = readCached<unknown>('profile/quick-notes');
  const notesPayload = notesCache?.data as { notes?: unknown } | unknown[] | undefined;
  const notes = Array.isArray(notesPayload) ? notesPayload : asArray(notesPayload?.notes);
  notes.slice(0, 20).forEach((entry, index) => {
    const note = entry as { id?: unknown; text?: unknown };
    if (typeof note?.text !== 'string' || !note.text.trim()) return;
    results.push({
      id: `note-${typeof note.id === 'string' ? note.id : index}`,
      kind: 'note',
      title: note.text.trim(),
      subtitle: 'โน้ตด่วนในแดชบอร์ด',
      href: '/dashboard',
      icon: <StickyNote size={15} aria-hidden="true" />,
      keywords: 'note notes โน้ต',
    });
  });

  const watchCache = readCached<unknown>('profile/watchlist');
  const watchPayload = watchCache?.data as
    | { items?: unknown; symbols?: unknown }
    | unknown[]
    | undefined;
  const watchlist = Array.isArray(watchPayload)
    ? watchPayload
    : asArray(watchPayload?.items ?? watchPayload?.symbols);
  watchlist.slice(0, 20).forEach((entry, index) => {
    const symbol =
      typeof entry === 'string'
        ? entry
        : (entry as { symbol?: unknown; name?: unknown })?.symbol ??
          (entry as { name?: unknown })?.name;
    if (typeof symbol !== 'string' || !symbol.trim()) return;
    results.push({
      id: `watch-${symbol}-${index}`,
      kind: 'watchlist',
      title: symbol,
      subtitle: 'รายการติดตาม',
      href: '/dashboard',
      icon: <TrendingUp size={15} aria-hidden="true" />,
      keywords: 'watchlist หุ้น ติดตาม',
    });
  });

  const reminderCache = readCached<unknown>('profile/reminders');
  const reminderPayload = reminderCache?.data as
    | { reminders?: unknown }
    | unknown[]
    | undefined;
  const reminders = Array.isArray(reminderPayload)
    ? reminderPayload
    : asArray(reminderPayload?.reminders);
  reminders.slice(0, 20).forEach((entry, index) => {
    const reminder = entry as { id?: unknown; title?: unknown; date?: unknown };
    if (typeof reminder?.title !== 'string' || !reminder.title.trim()) return;
    results.push({
      id: `reminder-${typeof reminder.id === 'string' ? reminder.id : index}`,
      kind: 'reminder',
      title: reminder.title.trim(),
      subtitle:
        typeof reminder.date === 'string' ? `เตือนของฉัน · ${reminder.date}` : 'เตือนของฉัน',
      href: '/dashboard',
      icon: <CalendarClock size={15} aria-hidden="true" />,
      keywords: 'reminder เตือน ธุระ ลา',
    });
  });

  return results;
}

export default function CommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState<CommandResult[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [localResults, setLocalResults] = useState<CommandResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K opens, Escape closes. Captured on the window so the shortcut
  // works on every page without each one registering a handler.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Refresh the offline mirrors and load the admin user index each time the
  // palette opens: a stale list would send the search to the wrong page.
  useEffect(() => {
    if (!open) return;
    setLocalResults(collectLocalResults());
    inputRef.current?.focus();

    if (!isAdmin) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);
    (async () => {
      try {
        const res = await fetchWithAuth('/api/v1/users?skip=0&limit=100');
        if (!res.ok) return;
        const body = (await res.json()) as unknown;
        if (cancelled || !Array.isArray(body)) return;
        const mapped: CommandResult[] = [];
        body.forEach((entry, index) => {
          const record = entry as { id?: unknown; name?: unknown; email?: unknown };
          const title =
            typeof record.name === 'string' && record.name.trim()
              ? record.name.trim()
              : typeof record.email === 'string'
                ? record.email
                : '';
          if (!title) return;
          mapped.push({
            id: `user-${typeof record.id === 'number' ? record.id : index}`,
            kind: 'user',
            title,
            subtitle: typeof record.email === 'string' ? record.email : 'ผู้ใช้ในระบบ',
            href: '/admin',
            icon: <Shield size={15} aria-hidden="true" />,
            keywords: `user ผู้ใช้ admin ${record.email ?? ''}`,
          });
        });
        setUsers(mapped);
      } catch {
        // The palette still works for pages without the user index.
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isAdmin]);

  const pageResults = useMemo<CommandResult[]>(() => {
    const menu = DEFAULT_MAIN_MENU_ITEMS.filter(
      (item) => item.enabled && (!item.adminOnly || isAdmin),
    ).map((item) => {
      const Icon = MAIN_MENU_ICON_MAP[item.icon] ?? FileText;
      return {
        id: `page-${item.id}`,
        kind: 'page' as const,
        title: item.name,
        subtitle: item.description,
        href: item.href,
        icon: <Icon size={15} aria-hidden="true" />,
        keywords: `${item.id} ${item.name} ${item.description ?? ''}`,
      };
    });

    const extra: CommandResult[] = [
      ...PROFILE_ACTIONS,
      ...(isAdmin
        ? [
            {
              id: 'page-audit',
              kind: 'page' as const,
              title: 'บันทึกกิจกรรม',
              subtitle: 'ประวัติการใช้งานทั้ง workspace',
              href: '/audit',
              icon: <FileText size={15} aria-hidden="true" />,
              keywords: 'audit log บันทึก ประวัติ',
            },
          ]
        : []),
    ];

    return [...menu, ...extra];
  }, [isAdmin]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = [...pageResults, ...localResults, ...users];
    const matched = term
      ? pool.filter((item) =>
          `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`
            .toLowerCase()
            .includes(term),
        )
      : pageResults;
    return matched.slice(0, 12);
  }, [query, pageResults, localResults, users]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const run = useCallback(
    (result: CommandResult | undefined) => {
      if (!result) return;
      close();
      router.push(result.href ?? '/dashboard');
    },
    [close, router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหาทั่วทั้งระบบ"
        className="w-full max-w-xl overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] px-4 py-3">
          <Search size={16} className="shrink-0 text-[var(--ink-tertiary)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => (value + 1) % Math.max(results.length, 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(
                  (value) => (value - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1),
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(results[active]);
              }
            }}
            placeholder="ค้นหาหน้า โน้ต รายการติดตาม เตือนของฉัน หรือผู้ใช้…"
            aria-label="ค้นหา"
            className="w-full bg-transparent text-[14px] font-medium text-[var(--ink)] outline-hidden placeholder:text-[var(--ink-tertiary)]"
          />
          {loadingUsers && (
            <Loader2 size={14} className="animate-spin text-[var(--ink-tertiary)]" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={close}
            aria-label="ปิดการค้นหา"
            className="rounded-full p-1 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-tertiary)]">
              ไม่พบผลลัพธ์สำหรับ “{query}”
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => run(result)}
                className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors ${
                  index === active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-[var(--ink)] hover:bg-[var(--surface-grouped)]'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-grouped-2)] text-[var(--ink-muted)]">
                  {result.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{result.title}</span>
                  {result.subtitle && (
                    <span className="block truncate text-[11.5px] text-[var(--ink-tertiary)]">
                      {result.subtitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-[var(--surface-grouped-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
                  {KIND_LABEL[result.kind]}
                </span>
                {index === active && (
                  <CornerDownLeft size={13} className="shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-[11px] text-[var(--ink-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <ArrowRight size={11} aria-hidden="true" /> ↑↓ เลือก · Enter เปิด
          </span>
          <kbd className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
        </div>
      </div>
    </div>
  );
}
