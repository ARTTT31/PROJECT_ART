'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MapPin,
  RefreshCw,
  Trophy,
  Users,
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

export interface MatchGoal {
  clock: string;
  team_id: string;
  player: string;
  type: 'goal' | 'penalty' | 'own_goal' | string;
}

export interface MatchCard {
  clock: string;
  team_id: string;
  player: string;
  type: 'red' | 'yellow' | string;
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
  goals?: MatchGoal[];
  cards?: MatchCard[];
  headline?: string | null;
  attendance?: number | null;
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

export interface StandingTeam {
  rank: number;
  team: {
    id: string;
    name: string;
    full_name: string;
    abbreviation: string;
    logo: string | null;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goal_diff: string;
  points: number;
}

export interface StandingsData {
  success: boolean;
  league: string;
  season: number;
  standings: StandingTeam[];
  fetched_at: string | null;
  is_stale?: boolean;
}

const CACHE_PREFIX = 'artPremierLeagueCacheV2';
const CACHE_TTL_MS = 10 * 60_000;
const LIVE_REFRESH_MS = 60_000;
const IDLE_REFRESH_MS = 5 * 60_000;
const STANDINGS_CACHE_KEY = `${CACHE_PREFIX}:standings`;
const STANDINGS_CACHE_TTL_MS = 30 * 60_000;

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

function loadCache<T>(key: string): { savedAt: number; data: T } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    return parsed?.savedAt && parsed?.data ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* private mode */
  }
}

function newestEventDate(data: FootballData | null): string | null {
  if (!data?.events?.length) return null;
  const liveMatch = data.events.find((event) => event.state === 'in' && event.kickoff);
  if (liveMatch?.kickoff) return isoDate(new Date(liveMatch.kickoff));

  const finished = data.events
    .filter((event) => event.state === 'post' && event.kickoff)
    .sort((a, b) => new Date(b.kickoff!).getTime() - new Date(a.kickoff!).getTime());
  if (finished[0]?.kickoff) return isoDate(new Date(finished[0].kickoff));

  const upcoming = data.events
    .filter((event) => event.kickoff)
    .sort((a, b) => new Date(a.kickoff!).getTime() - new Date(b.kickoff!).getTime());
  if (upcoming[0]?.kickoff) return isoDate(new Date(upcoming[0].kickoff));

  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PremierLeagueWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches');
  const [data, setData] = useState<FootballData | null>(null);
  const [standingsData, setStandingsData] = useState<StandingsData | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
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

  const loadStandings = useCallback(async (opts?: { refresh?: boolean }) => {
    const cached = loadCache<StandingsData>(STANDINGS_CACHE_KEY);
    if (!opts?.refresh && cached && Date.now() - cached.savedAt <= STANDINGS_CACHE_TTL_MS) {
      setStandingsData(cached.data);
      return;
    }

    setStandingsLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/football/standings');
      if (res.ok) {
        const result = (await res.json()) as StandingsData;
        if (result.success && Array.isArray(result.standings)) {
          setStandingsData(result);
          saveCache(STANDINGS_CACHE_KEY, result);
        }
      }
    } catch (err) {
      console.warn('Standings fetch failed:', err);
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = `${CACHE_PREFIX}:${selectedDate ?? 'latest'}`;
    const cached = loadCache<FootballData>(key);
    if (cached && Date.now() - cached.savedAt <= CACHE_TTL_MS) {
      setData(cached.data);
      setFromCache(true);
      setLoading(false);
    } else {
      setData(null);
    }
    void load(selectedDate);
  }, [selectedDate, load]);

  useEffect(() => {
    if (activeTab === 'standings' && !standingsData) {
      void loadStandings();
    }
  }, [activeTab, standingsData, loadStandings]);

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
  const shownFinished = width === 1 ? finished.slice(0, 6) : finished;

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
                      : activeTab === 'standings'
                        ? 'ตารางคะแนนฤดูกาล 2026/27'
                        : `${finished.length} ผล · ${upcoming.length} โปรแกรม`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'standings') {
                void loadStandings({ refresh: true });
              } else {
                void load(selectedDate, { refresh: true });
              }
            }}
            aria-label="รีเฟรชผลพรีเมียร์ลีก"
            title="รีเฟรช"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.95]"
          >
            <RefreshCw
              size={13}
              className={refreshing || standingsLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
      </div>

      {/* ── Tabs (ผล & โปรแกรม vs ตารางคะแนน) ────────────────────────── */}
      <div className="mt-2.5 flex rounded-apple-md bg-[var(--surface-grouped)] p-0.5 border border-[var(--hairline)]">
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex-1 rounded-[9px] py-1 text-center text-xs font-semibold transition-all ${
            activeTab === 'matches'
              ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
              : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
          }`}
        >
          ผล & โปรแกรม
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('standings')}
          className={`flex-1 rounded-[9px] py-1 text-center text-xs font-semibold transition-all ${
            activeTab === 'standings'
              ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
              : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
          }`}
        >
          ตารางคะแนน
        </button>
      </div>

      {/* ── Matches View ─────────────────────────────────────────────────── */}
      {activeTab === 'matches' && (
        <>
          {/* ── Date picker ──────────────────────────────────────────────── */}
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
              <CalendarDays
                size={12}
                className="shrink-0 text-[var(--ink-tertiary)]"
                aria-hidden="true"
              />
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

          {/* ── Error ────────────────────────────────────────────────────── */}
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

          {/* ── Match List ──────────────────────────────────────────────── */}
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
            <div className="mt-2.5 max-h-80 space-y-2.5 overflow-y-auto pr-0.5">
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
        </>
      )}

      {/* ── Standings Table View ─────────────────────────────────────────── */}
      {activeTab === 'standings' && (
        <div className="mt-2.5 flex-1 overflow-hidden flex flex-col">
          {standingsLoading && !standingsData ? (
            <div className="space-y-2 py-4" role="status" aria-label="กำลังโหลดตารางคะแนน">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded-apple-md bg-[var(--surface-grouped)]"
                />
              ))}
            </div>
          ) : !standingsData?.standings?.length ? (
            <p className="mt-8 text-center text-sm text-[var(--ink-secondary)]">
              ไม่พบข้อมูลตารางคะแนน
            </p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="max-h-80 overflow-y-auto pr-0.5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--hairline)] text-[10px] font-bold text-[var(--ink-tertiary)] uppercase tracking-wider">
                      <th className="py-1.5 pl-1 w-6 text-center">#</th>
                      <th className="py-1.5 pl-2">ทีม</th>
                      <th className="py-1.5 px-1 text-center w-8">แข่ง</th>
                      <th className="py-1.5 px-1 text-center w-8">ชนะ</th>
                      <th className="py-1.5 px-1 text-center w-8">เสมอ</th>
                      <th className="py-1.5 px-1 text-center w-8">แพ้</th>
                      <th className="py-1.5 px-1 text-center w-9">+/-</th>
                      <th className="py-1.5 pr-2 text-right w-10 font-extrabold text-[var(--ink)]">
                        แต้ม
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hairline-soft)]">
                    {standingsData.standings.map((team) => {
                      const isTop4 = team.rank <= 4;
                      const isEuropa = team.rank === 5;
                      const isRelegation = team.rank >= 18;

                      return (
                        <tr
                          key={team.team.id}
                          className="hover:bg-[var(--surface-grouped)] transition-colors"
                        >
                          <td className="py-1.5 pl-1 text-center font-bold">
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                                isTop4
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-extrabold'
                                  : isEuropa
                                    ? 'bg-[var(--warning-soft)] text-[var(--warning-ink)] font-bold'
                                    : isRelegation
                                      ? 'bg-[var(--danger-soft)] text-[var(--danger-ink)] font-bold'
                                      : 'text-[var(--ink-secondary)]'
                              }`}
                            >
                              {team.rank}
                            </span>
                          </td>
                          <td className="py-1.5 pl-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {team.team.logo && (
                                <Image
                                  src={team.team.logo}
                                  alt=""
                                  width={18}
                                  height={18}
                                  unoptimized
                                  className="h-4 w-4 shrink-0 object-contain"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-semibold text-[var(--ink)] truncate max-w-[110px] sm:max-w-[140px]">
                                {team.team.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-1 text-center tabular-nums text-[var(--ink-secondary)]">
                            {team.played}
                          </td>
                          <td className="py-1.5 px-1 text-center tabular-nums text-[var(--ink-secondary)]">
                            {team.won}
                          </td>
                          <td className="py-1.5 px-1 text-center tabular-nums text-[var(--ink-secondary)]">
                            {team.drawn}
                          </td>
                          <td className="py-1.5 px-1 text-center tabular-nums text-[var(--ink-secondary)]">
                            {team.lost}
                          </td>
                          <td className="py-1.5 px-1 text-center tabular-nums text-[var(--ink-secondary)] font-medium">
                            {team.goal_diff}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums font-extrabold text-[var(--ink)]">
                            {team.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Table Legend ────────────────────────────────────────── */}
              <div className="mt-2 pt-2 border-t border-[var(--hairline-soft)] flex items-center justify-between text-[10px] text-[var(--ink-tertiary)]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> 1-4 UCL
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 5 UEL
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> 18-20 ตกชั้น
                </span>
              </div>
            </div>
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
  const [expanded, setExpanded] = useState(false);
  const hasScore = match.home.score !== null && match.away.score !== null;
  const hasGoals = Boolean(match.goals && match.goals.length > 0);
  const hasCards = Boolean(match.cards && match.cards.length > 0);
  const hasDetails = hasGoals || hasCards || match.headline || match.venue || match.attendance;

  return (
    <li
      className={`rounded-apple-widget border transition-colors ${
        live
          ? 'border-[var(--danger-soft)] bg-[var(--danger-soft)]'
          : 'border-[var(--hairline-soft)] bg-[var(--surface-grouped)]'
      }`}
    >
      <div
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onClick={() => hasDetails && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className={`px-2.5 py-2 ${hasDetails ? 'cursor-pointer select-none' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <TeamLine team={match.home} opponent={match.away} />
            <TeamLine team={match.away} opponent={match.home} />
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="space-y-1 text-right tabular-nums">
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
            {hasDetails && (
              <span className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
              {match.state === 'pre'
                ? formatDay(match.kickoff)
                : match.kickoff
                  ? `${formatDay(match.kickoff)} · ${match.detail || 'FT'}`
                  : match.detail || 'FT'}
            </span>
          )}
          {match.venue && <span className="truncate">{match.venue}</span>}
          {match.broadcast && (
            <span className="ml-auto shrink-0 truncate text-[var(--ink-muted)]">
              {match.broadcast}
            </span>
          )}
        </div>
      </div>

      {/* ── Expandable Match Details ─────────────────────────────────────── */}
      {expanded && hasDetails && (
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2.5 bg-[var(--surface)] rounded-b-apple-widget space-y-2 text-xs">
          {/* Goals */}
          {hasGoals && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[var(--ink-tertiary)] uppercase tracking-wider">
                ผู้ทำประตู
              </p>
              <div className="space-y-0.5">
                {match.goals?.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[var(--ink)]">
                    <span className="shrink-0">⚽</span>
                    <span className="font-semibold">{g.player}</span>
                    <span className="text-[var(--ink-muted)]">
                      {g.clock}
                      {g.type === 'penalty' ? ' (จุดโทษ)' : g.type === 'own_goal' ? ' (OG)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards */}
          {hasCards && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[var(--ink-tertiary)] uppercase tracking-wider">
                ใบเตือน / ใบแดง
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {match.cards?.map((c, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium bg-[var(--surface-chip)]"
                  >
                    <span>{c.type === 'red' ? '🟥' : '🟨'}</span>
                    <span className="font-semibold text-[var(--ink)]">{c.player}</span>
                    <span className="text-[var(--ink-muted)]">{c.clock}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recap description */}
          {match.headline && (
            <p className="text-[11px] leading-relaxed text-[var(--ink-secondary)] italic pt-1 border-t border-[var(--hairline-soft)]">
              &ldquo;{match.headline.trim()}&rdquo;
            </p>
          )}

          {/* Venue & Attendance */}
          {(match.venue || match.attendance) && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-[var(--ink-tertiary)] border-t border-[var(--hairline-soft)]">
              {match.venue && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} aria-hidden="true" />
                  <span>{match.venue}</span>
                </span>
              )}
              {typeof match.attendance === 'number' && (
                <span className="flex items-center gap-1">
                  <Users size={11} aria-hidden="true" />
                  <span>ผู้ชม: {match.attendance.toLocaleString()} คน</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
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
