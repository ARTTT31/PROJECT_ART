'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Banknote, Coins, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface CurrencyRate {
  code: string;
  name: string;
  unit: number;
  thb: number;
}

interface CurrencyBlock {
  source: string;
  updated_at: string | null;
  rates: CurrencyRate[];
}

interface GoldBlock {
  source: string;
  updated_at: string | null;
  buy: number;
  sell: number;
}

interface SetBlock {
  source: string;
  updated_at: string | null;
  value: number;
  change: number;
  change_percent: number;
}

interface MarketSummary {
  currency: CurrencyBlock | null;
  gold: GoldBlock | null;
  set_index: SetBlock | null;
  fetched_at: string;
  is_stale: boolean;
}

const CACHE_KEY = 'artMarketCacheV1';
const CACHE_TTL_MS = 10 * 60_000;
const REFRESH_MS = 10 * 60_000;

const money = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function loadCache(): { savedAt: number; data: MarketSummary } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: MarketSummary };
    if (!parsed?.savedAt || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data: MarketSummary) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* storage full or disabled — the widget still works */
  }
}

/** Show only HH:mm in Bangkok time for ISO timestamps; other strings pass through. */
function formatUpdated(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export default function MarketWidget({
  width = 2,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [data, setData] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    opts?.refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/v1/market/summary', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as MarketSummary;
      setData(payload);
      saveCache(payload);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError('โหลดข้อมูลตลาดไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadCache();
    if (cached && Date.now() - cached.savedAt <= CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
    }
    void load();
    const interval = setInterval(() => void load({ refresh: true }), REFRESH_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [load]);

  if (loading && !data) {
    return (
      <div
        className="flex min-h-[300px] items-center justify-center rounded-[18px] border border-black/[0.06] bg-white p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดข้อมูลตลาด"
      >
        <div className="grid w-full animate-pulse grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[18px] bg-[#f5f5f7]" />
          ))}
        </div>
      </div>
    );
  }

  const gold = data?.gold ?? null;
  const setIndex = data?.set_index ?? null;
  const rates = data?.currency?.rates ?? [];
  const setUp = (setIndex?.change ?? 0) >= 0;

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5"
      aria-labelledby="market-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ff9500]/10 text-[#c77700]">
            <Coins size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="market-title"
              className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]"
            >
              ค่าเงิน · ทอง · SET
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {refreshing
                ? 'กำลังอัปเดต...'
                : data?.is_stale
                  ? 'ข้อมูลบางส่วนอาจไม่เป็นปัจจุบัน'
                  : data?.fetched_at
                    ? `อัปเดต ${formatUpdated(data.fetched_at)}`
                    : 'อัตราแลกเปลี่ยน ราคาทอง และดัชนีตลาด'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-[12px] bg-[#ff3b30]/10 px-3 py-2 text-[12px] font-medium text-[#ff3b30]">
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

      <div className="mt-4 grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* ── Gold ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between rounded-[18px] bg-[#f5f5f7] p-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6e6e73]">
            <Coins size={13} aria-hidden="true" />
            ทองคำแท่ง 96.5%
          </div>
          {gold ? (
            <>
              <div className="mt-2 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-[#6e6e73]">รับซื้อ</span>
                  <span className="tabular-nums text-[16px] font-extrabold leading-none text-[#1d1d1f]">
                    {money.format(gold.buy)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-[#6e6e73]">ขายออก</span>
                  <span className="tabular-nums text-[16px] font-extrabold leading-none text-[#c77700]">
                    {money.format(gold.sell)}
                  </span>
                </div>
              </div>
              <p className="mt-2 truncate text-[10px] text-[#86868b]" title={gold.updated_at ?? ''}>
                {gold.updated_at || 'บาทละ'}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12px] text-[#86868b]">ยังไม่มีข้อมูลราคาทอง</p>
          )}
        </div>

        {/* ── SET index ────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between rounded-[18px] bg-[#f5f5f7] p-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6e6e73]">
            <TrendingUp size={13} aria-hidden="true" />
            ดัชนี SET
          </div>
          {setIndex ? (
            <>
              <div className="mt-2">
                <div className="tabular-nums text-[20px] font-extrabold leading-none text-[#1d1d1f]">
                  {plain.format(setIndex.value)}
                </div>
                <div
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    setUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {setUp ? (
                    <TrendingUp size={11} aria-hidden="true" />
                  ) : (
                    <TrendingDown size={11} aria-hidden="true" />
                  )}
                  {setUp ? '+' : ''}
                  {setIndex.change.toFixed(2)} ({setUp ? '+' : ''}
                  {setIndex.change_percent.toFixed(2)}%)
                </div>
              </div>
              <p className="mt-2 truncate text-[10px] text-[#86868b]">
                {formatUpdated(setIndex.updated_at) || 'ปิดตลาด'}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12px] text-[#86868b]">ยังไม่มีข้อมูลดัชนี</p>
          )}
        </div>

        {/* ── Currency ─────────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-[18px] bg-[#f5f5f7] p-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6e6e73]">
            <Banknote size={13} aria-hidden="true" />
            อัตราแลกเปลี่ยน (บาท)
          </div>
          {rates.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {rates.map((rate) => (
                <li
                  key={rate.code}
                  className="flex items-baseline justify-between gap-2 text-[11.5px]"
                >
                  <span className="truncate text-[#6e6e73]" title={rate.name}>
                    {rate.code}
                    {rate.unit > 1 ? ` ${rate.unit}` : ''}
                  </span>
                  <span className="tabular-nums font-bold text-[#1d1d1f]">
                    {money.format(rate.thb)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-[#86868b]">ยังไม่มีข้อมูลอัตราแลกเปลี่ยน</p>
          )}
          <p className="mt-auto pt-2 text-[10px] text-[#86868b]">บาทต่อ 1 หน่วย (JPY ต่อ 100)</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2 text-[10px] text-[#475569]">
        <span>ทอง: สมาคมค้าทองคำ · SET: Yahoo Finance</span>
        {refreshing && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
      </div>
    </section>
  );
}
