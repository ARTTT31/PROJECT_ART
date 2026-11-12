'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FootballTeam {
  id: string;
  name: string;
  full_name: string;
  abbreviation: string;
  logo: string | null;
  score: number | null;
  winner: boolean;
}

export interface FootballMatch {
  id: string;
  kickoff: string | null;
  status: string;
  detail: string;
  clock: string;
  state: 'pre' | 'in' | 'post' | string;
  completed: boolean;
  home: FootballTeam;
  away: FootballTeam;
  venue: string;
  broadcast: string;
}

interface FootballData {
  success: boolean;
  league: string;
  date: string | null;
  events: FootballMatch[];
  is_live?: boolean;
  fetched_at: string | null;
  is_stale?: boolean;
  source?: string;
}

const CACHE_PREFIX = 'artPremierLeagueCacheV2';
const CACHE_TTL_MS = 10 * 60_000;
const LIVE_REFRESH_MS = 60_000;
const IDLE_REFRESH_MS = 5 * 60_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function formatDay(iso: string | null): string {
  if (!iso) return '';
  const date = iso.length === 10 ? parseIso(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function formatFullDay(iso: string): string {
  const date = parseIso(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function loadCache(key: string): { savedAt: number; data: FootballData } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: FootballData };
    return parsed?.savedAt && parsed?.data ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(key: string, data: FootballData) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* private mode — the widget still works without a cache */
  }
}

function newestEventDate(data: FootballData | null): string | null {
  if (!data?.events?.length) return null;
  const times = data.events
    .map((event) => (event.kickoff ? new Date(event.kickoff) : null))
    .filter((value): value is Date => value !== null && !Number.isNaN(value.getTime()));
  if (times.length === 0) return null;
  return isoDate(new Date(Math.max(...times.map((value) => value.getTime()))));
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (date: string | null, opts?: { refresh?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    opts?.refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const query = date ? `?date=${date}` : '';
      const res = await fetchWithAuth(`/api/v1/football/premier-league${query}`, {
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
      saveCache(`${CACHE_PREFIX}:${date ?? 'latest'}`, result);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('Premier League fetch failed:', err);
      setError((err as { cause?: string })?.cause || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Date change: show the cached day immediately, then refresh from the API.
  useEffect(() => {
    const key = `${CACHE_PREFIX}:${selectedDate ?? 'latest'}`;
    const cached = loadCache(key);
    if (cached && Date.now() - cached.savedAt <= CACHE_TTL_MS) {
      setData(cached.data);
      setFromCache(true);
      setLoading(false);
    } else {
      setData(null);
    }
    void load(selectedDate);
  }, [selectedDate, load]);

  // Live scores refresh every minute; a finished matchday is checked every five.
  useEffect(() => {
    const delay = data?.is_live ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
    const interval = setInterval(() => void load(selectedDate, { refresh: true }), delay);
    return () => clearInterval(interval);
  }, [data?.is_live, selectedDate, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const todayIso = isoDate(new Date());
  const latestDay = newestEventDate(data);
  const anchorDate = selectedDate ?? latestDay ?? todayIso;

  const shiftDay = (delta: number) => {
    const next = parseIso(anchorDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(isoDate(next));
  };

  const events = data?.events ?? [];
  const live = events.filter((event) => event.state === 'in');
  const finished = events
    .filter((event) => event.state === 'post')
    .sort((a, b) => new Date(b.kickoff ?? 0).getTime() - new Date(a.kickoff ?? 0).getTime());
  const upcoming = events
    .filter((event) => event.state === 'pre')
    .sort((a, b) => new Date(a.kickoff ?? 0).getTime() - new Date(b.kickoff ?? 0).getTime());
  const shownFinished = width === 1 ? finished.slice(0, 4) : finished;

  const loadingFirst = loading && !data;

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
                : data?.is_live
                  ? 'กำลังแข่งขัน · อัปเดตทุกนาที'
                  : fromCache
                    ? 'แสดงข้อมูลจากแคช'
                    : data?.is_stale
                      ? 'ข้อมูลอาจไม่เป็นปัจจุบัน'
                      : `${finished.length} ผล · ${upcoming.length} โปรแกรม`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void load(selectedDate, { refresh: true })}
            aria-label="รีเฟรชผลพรีเมียร์ลีก"
            title="รีเฟรช"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.95]"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
      </div>

      {/* ── Date picker ─────────────────────────────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          aria-label="วันก่อนหน้า"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.95]"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>

        <label className="relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-colors hover:bg-[var(--surface-chip)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <CalendarDays size={12} className="shrink-0 text-[var(--ink-tertiary)]" aria-hidden="true" />
          <span className="truncate">
            {formatFullDay(anchorDate)}
            {!selectedDate && <span className="text-[var(--ink-tertiary)]"> · ล่าสุด</span>}
          </span>
          <input
            type="date"
            value={anchorDate}
            onChange={(event) => setSelectedDate(event.target.value || null)}
            aria-label="เลือกวันที่ดูผลพรีเมียร์ลีก"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <button
          type="button"
          onClick={() => shiftDay(1)}
          aria-label="วันถัดไป"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.95]"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>

        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="small-control shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-soft-weak)]"
          >
            ล่าสุด
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-apple-widget bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-medium text-[var(--danger)]">
          <span className="flex min-w-0 items-center gap-1.5">
            <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void load(selectedDate, { refresh: true })}
            className="shrink-0 font-bold underline"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {loadingFirst ? (
        <div className="mt-3 space-y-2" role="status" aria-label="กำลังโหลดผลพรีเมียร์ลีก">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[62px] animate-pulse rounded-apple-widget bg-[var(--surface-grouped)]"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        !error && (
          <p className="mt-6 flex flex-1 items-center justify-center text-center text-sm text-[var(--ink-secondary)]">
            ไม่มีแมตช์ในวันที่เลือก
          </p>
        )
      ) : (
        <div className="mt-2.5 max-h-72 space-y-2 overflow-y-auto pr-0.5">
          {live.length > 0 && (
            <MatchGroup label="กำลังแข่งขัน">
              {live.map((match) => (
                <MatchRow key={match.id} match={match} live />
              ))}
            </MatchGroup>
          )}

          {shownFinished.length > 0 && (
            <MatchGroup label="ผลการแข่งขัน">
              {shownFinished.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </MatchGroup>
          )}

          {upcoming.length > 0 && (
            <MatchGroup label="โปรแกรมถัดไป">
              {upcoming.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </MatchGroup>
          )}
        </div>
      )}
    </section>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function MatchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
        {label}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function MatchRow({ match, live = false }: { match: FootballMatch; live?: boolean }) {
  const hasScore = match.home.score !== null && match.away.score !== null;
  return (
    <li
      className={`rounded-apple-widget border px-2.5 py-2 ${
        live
          ? 'border-[var(--danger-soft)] bg-[var(--danger-soft)]'
          : 'border-[var(--hairline-soft)] bg-[var(--surface-grouped)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <TeamLine team={match.home} opponent={match.away} />
          <TeamLine team={match.away} opponent={match.home} />
        </div>
        <div className="shrink-0 space-y-1 text-right tabular-nums">
          {hasScore ? (
            <>
              <ScoreLine team={match.home} opponent={match.away} />
              <ScoreLine team={match.away} opponent={match.home} />
            </>
          ) : (
            <span className="text-[12px] font-bold text-[var(--ink)]">
              {formatTime(match.kickoff) || '—'}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[var(--ink-tertiary)]">
        {live ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--danger)] px-1.5 py-0.5 font-bold text-white">
            <span className="h-1 w-1 animate-pulse rounded-full bg-white" aria-hidden="true" />
            LIVE {match.clock || ''}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--surface-chip)] px-1.5 py-0.5 font-bold text-[var(--ink-secondary)]">
            {match.state === 'pre' ? formatDay(match.kickoff) : match.detail || 'FT'}
          </span>
        )}
        {match.venue && <span className="truncate">{match.venue}</span>}
        {match.broadcast && (
          <span className="ml-auto shrink-0 truncate text-[var(--ink-muted)]">
            {match.broadcast}
          </span>
        )}
      </div>
    </li>
  );
}

function TeamLogo({ team }: { team: FootballTeam }) {
  if (!team.logo) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-chip)] text-[9px] font-bold text-[var(--ink-secondary)]"
        aria-hidden="true"
      >
        {team.name.slice(0, 1)}
      </span>
    );
  }
  return (
    <Image
      src={team.logo}
      alt=""
      width={20}
      height={20}
      unoptimized
      className="h-5 w-5 shrink-0 object-contain"
      aria-hidden="true"
    />
  );
}

function TeamLine({ team, opponent }: { team: FootballTeam; opponent: FootballTeam }) {
  const decided = opponent.score !== null && team.score !== null;
  const dimmed = decided && !team.winner;
  return (
    <p
      className={`flex min-w-0 items-center gap-1.5 text-[13px] leading-tight ${
        dimmed ? 'font-medium text-[var(--ink-secondary)]' : 'font-semibold text-[var(--ink)]'
      }`}
    >
      <TeamLogo team={team} />
      <span className="truncate">{team.name}</span>
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
