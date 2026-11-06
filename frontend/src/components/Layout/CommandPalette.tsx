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
  ExternalLink,
  Timer,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitleSR } from '@/components/ui/Dialog';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { readCached } from '@/lib/offline/localStore';
import { DEFAULT_MAIN_MENU_ITEMS, MAIN_MENU_ICON_MAP } from '@/utils/mainMenu';
import { isPageEnabled } from '@/hooks/useEnabledPages';
import { MENU_LABEL_KEYS, type MessageKey } from '@/lib/i18n/messages';
import { useI18n, type Translate } from '@/lib/i18n/I18nProvider';

/** Open the palette from anywhere (the header button dispatches this). */
export const COMMAND_PALETTE_EVENT = 'art:command-palette';

export function openCommandPalette() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

type ResultKind = 'page' | 'note' | 'watchlist' | 'reminder' | 'user' | 'quicklink' | 'action';

interface CommandResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href?: string;
  icon: React.ReactNode;
  /** Extra words that should match but are not shown. */
  keywords?: string;
  isExternal?: boolean;
}

const KIND_KEYS: Record<ResultKind, MessageKey> = {
  page: 'palette.kind.page',
  note: 'palette.kind.note',
  watchlist: 'palette.kind.watchlist',
  reminder: 'palette.kind.reminder',
  user: 'palette.kind.user',
  quicklink: 'palette.kind.quicklink',
  action: 'palette.kind.action',
};

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
function collectLocalResults(t: Translate): CommandResult[] {
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
      subtitle: t('palette.note.subtitle'),
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
      subtitle: t('palette.watch.subtitle'),
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
        typeof reminder.date === 'string'
          ? t('palette.reminder.subtitle.dated', { date: reminder.date })
          : t('palette.reminder.subtitle'),
      href: '/dashboard',
      icon: <CalendarClock size={15} aria-hidden="true" />,
      keywords: 'reminder เตือน ธุระ ลา',
    });
  });

  const linksCache = readCached<unknown>('profile/quick-links');
  const linksPayload = linksCache?.data as unknown[] | undefined;
  const links = Array.isArray(linksPayload) ? linksPayload : [];
  links.slice(0, 20).forEach((entry, index) => {
    const link = entry as { id?: unknown; title?: unknown; name?: unknown; url?: unknown };
    const title = typeof link?.title === 'string' ? link.title : typeof link?.name === 'string' ? link.name : '';
    if (!title.trim()) return;
    results.push({
      id: `link-${typeof link.id === 'string' ? link.id : index}`,
      kind: 'quicklink',
      title: title.trim(),
      subtitle: typeof link.url === 'string' ? link.url : 'ควิกลิ้งค์',
      href: typeof link.url === 'string' ? link.url : undefined,
      isExternal: true,
      icon: <ExternalLink size={15} aria-hidden="true" />,
      keywords: `link quicklink ควิกลิ้งค์ ${title} ${link.url ?? ''}`,
    });
  });

  return results;
}

export default function CommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState<CommandResult[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [localResults, setLocalResults] = useState<CommandResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';

  const close = useCallback(() => setOpen(false), []);

  // Every close path (Escape, overlay click, built-in X, ⌘K) clears the query,
  // so reopening never shows the previous search.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setActive(0);
  }, [open]);

  // ⌘K / Ctrl+K opens, Escape closes. Captured on the window so the shortcut
  // works on every page without each one registering a handler.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
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
    setLocalResults(collectLocalResults(t));

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
            subtitle:
              typeof record.email === 'string' ? record.email : t('palette.user.subtitle'),
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
  }, [open, isAdmin, t]);

  // Profile sections that exist today; the settings tab is the deep link.
  const profileActions = useMemo<CommandResult[]>(
    () => [
      {
        id: 'profile-settings',
        kind: 'page',
        title: t('palette.action.profileSettings'),
        subtitle: t('palette.action.profileSettings.sub'),
        href: '/profile?tab=preferences',
        icon: <Shield size={15} aria-hidden="true" />,
        keywords: 'profile settings theme preferences ธีม ตั้งค่า',
      },
    ],
    [t],
  );

  const pageResults = useMemo<CommandResult[]>(() => {
    // A page the admin switched off must not turn up in search either, otherwise
    // the palette offers a result that can only end on the "no access" screen.
    const menu = DEFAULT_MAIN_MENU_ITEMS.filter(
      (item) => (!item.adminOnly || isAdmin) && isPageEnabled(item.id),
    ).map((item) => {
      const Icon = MAIN_MENU_ICON_MAP[item.icon] ?? FileText;
      const labelKey = MENU_LABEL_KEYS[item.id];
      const title = labelKey ? t(labelKey) : item.name;
      const description = labelKey
        ? t(`${labelKey}.desc` as MessageKey)
        : item.description;
      return {
        id: `page-${item.id}`,
        kind: 'page' as const,
        title,
        subtitle: description,
        href: item.href,
        icon: <Icon size={15} aria-hidden="true" />,
        // The Thai name and description stay in the haystack so a search in
        // either language finds the same page.
        keywords: `${item.id} ${item.name} ${item.description ?? ''} ${title}`,
      };
    });

    const extra: CommandResult[] = [
      ...profileActions,
      ...(isAdmin && isPageEnabled('audit')
        ? [
            {
              id: 'page-audit',
              kind: 'page' as const,
              title: t('palette.result.audit'),
              subtitle: t('palette.result.audit.sub'),
              href: '/audit',
              icon: <FileText size={15} aria-hidden="true" />,
              keywords: 'audit log บันทึก ประวัติ activity',
            },
          ]
        : []),
    ];

    const quickActions: CommandResult[] = [
      {
        id: 'action-focustimer',
        kind: 'action' as const,
        title: 'เริ่มโฟกัส & จับเวลา (Focus Timer)',
        subtitle: 'ไปที่หน้าแดชบอร์ดเพื่อเริ่มจับเวลา Pomodoro',
        href: '/dashboard',
        icon: <Timer size={15} aria-hidden="true" />,
        keywords: 'pomodoro timer focus โฟกัส จับเวลา นาฬิกา',
      },
      {
        id: 'action-calendar',
        kind: 'action' as const,
        title: 'เปิดปฏิทิน & ตารางนัดหมาย (Calendar)',
        subtitle: 'ดูวันหยุดและนัดหมายในแดชบอร์ด',
        href: '/dashboard',
        icon: <CalendarClock size={15} aria-hidden="true" />,
        keywords: 'calendar ปฏิทิน นัดหมาย วันหยุด เตือน',
      },
      {
        id: 'action-backup',
        kind: 'action' as const,
        title: 'สำรองและกู้คืนข้อมูล (Backup & Restore)',
        subtitle: 'ดาวน์โหลดหรือนำเข้าข้อมูล Workspace',
        href: '/profile?tab=preferences',
        icon: <Shield size={15} aria-hidden="true" />,
        keywords: 'backup restore สำรอง กู้คืน json',
      },
    ];

    return [...menu, ...extra, ...quickActions];
  }, [isAdmin, profileActions, t]);

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
      if (result.isExternal && result.href) {
        window.open(result.href, '_blank', 'noopener,noreferrer');
        return;
      }
      router.push(result.href ?? '/dashboard');
    },
    [close, router],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      {/* The project Dialog supplies the focus trap, Escape handling, overlay
          dismissal, scroll lock and focus restore that this palette used to
          reimplement by hand. */}
      <DialogContent
        aria-label={t('palette.title')}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        className="top-[12vh] max-w-xl translate-y-0 rounded-[18px]"
      >
        <DialogTitleSR>{t('palette.title')}</DialogTitleSR>
        <div className="flex min-h-12 items-center gap-2.5 border-b border-[var(--hairline)] py-3 pl-4 pr-14">
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
            placeholder={t('palette.placeholder')}
            aria-label={t('nav.search.label')}
            className="w-full bg-transparent text-[14px] font-medium text-[var(--ink)] outline-hidden placeholder:text-[var(--ink-tertiary)]"
          />
          {loadingUsers && (
            <Loader2 size={14} className="animate-spin text-[var(--ink-tertiary)]" aria-hidden="true" />
          )}
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">
              {t('palette.empty', { query })}
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => run(result)}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                  index === active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-[var(--ink)] hover:bg-[var(--surface-grouped)]'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-grouped-2)] text-[var(--ink-muted)]">
                  {result.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{result.title}</span>
                  {result.subtitle && (
                    <span className="block truncate text-[12px] text-[var(--ink-tertiary)]">
                      {result.subtitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-[var(--surface-grouped-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-muted)]">
                  {t(KIND_KEYS[result.kind])}
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
            <ArrowRight size={11} aria-hidden="true" /> {t('palette.hint')}
          </span>
          <kbd className="rounded-[11px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px]">
            Esc
          </kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}
