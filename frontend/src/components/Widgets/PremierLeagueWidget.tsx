'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, RefreshCw, Trophy } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FootballTeam {
  id: string;
  name: string;
  full_name: string;
  abbreviation: string;
  score: number | null;
  winner: boolean;
}

export interface FootballMatch {
  id: string;
  kickoff: string | null;
  status: string;
  detail: string;
  state: 'pre' | 'in' | 'post' | string;
  completed: boolean;
  home: FootballTeam;
  away: FootballTeam;
  venue: string;
}

interface FootballData {
  success: boolean;
  league: string;
  events: FootballMatch[];
  fetched_at: string | null;
  is_stale?: boolean;
  source?: string;
}

const CACHE_KEY = 'artPremierLeagueCacheV1';
const CACHE_TTL_MS = 10 * 60_000;
const REFRESH_MS = 5 * 60_000;

type EplCache = { savedAt: number; data: FootballData };

function loadCache(): EplCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EplCache;
    return parsed?.savedAt && parsed?.data ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(data: FootballData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* private mode — the widget still works without a cache */
  }
}

function formatDay(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PremierLeagueWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [data, setData] = useState<FootballData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    opts?.refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const res = await fetchWithAuth('/api/v1/football/premier-league', {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`, { cause: 'โหลดผลพรีเมียร์ลีกไม่สำเร็จ' });
      }
      const result = (await res.json()) as FootballData;
      if (!result.success || !Array.isArray(result.events)) {
        throw new Error('invalid payload', { cause: 'รูปแบบข้อมูลไม่ถูกต้อง' });
      }
      setData(result);
      setFromCache(false);
      saveCache(result);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('Premier League fetch failed:', err);
      setError((err as { cause?: string })?.cause || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadCache();
    if (cached && Date.now() - cached.savedAt <= CACHE_TTL_MS) {
      setData(cached.data);
      setFromCache(true);
      setLoading(false);
    }
    void load();
    const interval = setInterval(() => void load({ refresh: true }), REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const finishPanel = loading && !data;

  if (finishPanel) {
    return (
      <div
        className="flex h-full min-h-[300px] flex-col rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดผลพรีเมียร์ลีก"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-apple-md bg-[var(--surface-grouped-2)]" />
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--surface-chip)]" />
            <div className="h-3 w-36 animate-pulse rounded-full bg-[var(--surface-grouped-2)]" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-apple-widget bg-[var(--surface-grouped)]" />
          ))}
        </div>
      </div>
    );
  }

  const events = data?.events ?? [];
  const finished = events
    .filter((event) => event.state === 'post' && event.completed)
    .sort((a, b) => new Date(b.kickoff ?? 0).getTime() - new Date(a.kickoff ?? 0).getTime());
  const nextMatch = events
    .filter((event) => event.state === 'pre')
    .sort((a, b) => new Date(a.kickoff ?? 0).getTime() - new Date(b.kickoff ?? 0).getTime())[0];

  // A one-column tile only has room for the last few results; wider tiles show
  // the whole matchday.
  const shown = width === 1 ? finished.slice(0, 3) : finished;

  return (
    <section
      className="flex h-full flex-col rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 transition-all duration-200"
      aria-labelledby="epl-widget-title"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Trophy size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="epl-widget-title"
              className="truncate text-[15px] font-bold tracking-tight text-[var(--ink)]"
            >
              พรีเมียร์ลีก
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--ink-tertiary)]">
              {loading || refreshing
                ? 'กำลังอัปเดต...'
                : fromCache
                  ? 'แสดงข้อมูลจากแคช'
                  : data?.is_stale
                    ? 'ข้อมูลอาจไม่เป็นปัจจุบัน'
                    : `ผลล่าสุด ${finished.length} นัด`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void load({ refresh: true })}
            aria-label="รีเฟรชผลพรีเมียร์ลีก"
            title="รีเฟรช"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.95]"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-apple-widget bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-medium text-[var(--danger)]">
          <span className="flex min-w-0 items-center gap-1.5">
            <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void load({ refresh: true })}
            className="shrink-0 font-bold underline"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {data?.is_stale && !error && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--warning)]">
          <AlertCircle size={11} aria-hidden="true" /> ข้อมูลอาจไม่เป็นปัจจุบัน
        </p>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {shown.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {shown.map((match) => (
            <li
              key={match.id}
              className="rounded-apple-widget border border-[var(--hairline-soft)] bg-[var(--surface-grouped)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <TeamLine team={match.home} opponent={match.away} />
                  <TeamLine team={match.away} opponent={match.home} />
                </div>
                <div className="shrink-0 space-y-0.5 text-right tabular-nums">
                  <ScoreLine team={match.home} opponent={match.away} />
                  <ScoreLine team={match.away} opponent={match.home} />
                </div>
              </div>
              <p className="mt-1.5 truncate text-[10px] font-medium text-[var(--ink-tertiary)]">
                {formatDay(match.kickoff)} · {match.detail || match.status || 'จบเกม'}
                {match.venue ? ` · ${match.venue}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <p className="mt-4 flex flex-1 items-center justify-center text-center text-sm text-[var(--ink-secondary)]">
            ยังไม่มีผลการแข่งขัน
          </p>
        )
      )}

      {/* ── Next fixture ────────────────────────────────────────────────── */}
      {nextMatch && (
        <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--hairline-soft)] pt-2.5">
          <CalendarClock size={15} className="shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--ink-secondary)]">
            นัดถัดไป: {nextMatch.home.name} – {nextMatch.away.name}
          </p>
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
            {formatDay(nextMatch.kickoff)} {formatTime(nextMatch.kickoff)}
          </span>
        </div>
      )}
    </section>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function TeamLine({ team, opponent }: { team: FootballTeam; opponent: FootballTeam }) {
  const decided = opponent.score !== null && team.score !== null;
  const dimmed = decided && !team.winner;
  return (
    <p
      className={`truncate text-[13px] leading-tight ${
        dimmed ? 'font-medium text-[var(--ink-secondary)]' : 'font-semibold text-[var(--ink)]'
      }`}
    >
      {team.name}
    </p>
  );
}

function ScoreLine({ team, opponent }: { team: FootballTeam; opponent: FootballTeam }) {
  const decided = opponent.score !== null && team.score !== null;
  const dimmed = decided && !team.winner;
  return (
    <p
      className={`text-[15px] font-extrabold leading-tight ${
        dimmed ? 'text-[var(--ink-muted)]' : 'text-[var(--ink)]'
      }`}
    >
      {team.score ?? '—'}
    </p>
  );
}
