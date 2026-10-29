'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEventHandler, ReactNode } from 'react';
import {
  AlertCircle,
  Banknote,
  ChevronDown,
  Coins,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface CurrencyRate {
  code: string;
  name: string;
  unit: number;
  thb: number;
}

interface CurrencyBlock {
  id: string;
  source: string;
  updated_at: string | null;
  rates: CurrencyRate[];
}

interface GoldBlock {
  id: string;
  source: string;
  market?: string | null;
  updated_at: string | null;
  buy?: number | null;
  sell?: number | null;
  value?: number | null;
  change?: number | null;
  change_percent?: number | null;
  currency?: string | null;
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
  currency_sources?: CurrencyBlock[];
  gold: GoldBlock | null;
  gold_sources?: GoldBlock[];
  set_index: SetBlock | null;
  fetched_at: string;
  is_stale: boolean;
}

/**
 * A native <select> dressed up as a compact dropdown: the browser chrome is
 * stripped, a chevron is drawn over it, and hover/focus match the dashboard.
 * Staying a real <select> keeps the native mobile picker and keyboard support.
 */
function MarketSelect({
  id,
  ariaLabel,
  value,
  onChange,
  children,
  className = '',
}: {
  id?: string;
  ariaLabel: string;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        className="w-full appearance-none truncate rounded-[10px] border border-black/[0.08] bg-white py-1.5 pl-2.5 pr-6 text-[11px] font-medium text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-black/[0.16] focus-visible:border-[#0066cc]/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]/25"
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        strokeWidth={2.5}
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#86868b]"
      />
    </div>
  );
}

const CACHE_KEY = 'artMarketCacheV2';
const CACHE_TTL_MS = 10 * 60_000;
const REFRESH_MS = 10 * 60_000;

const money = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

const CURRENCIES: Array<[string, string]> = [
  ['USD', 'ดอลลาร์สหรัฐ'],
  ['EUR', 'ยูโร'],
  ['GBP', 'ปอนด์อังกฤษ'],
  ['CNY', 'หยวนจีน'],
  ['JPY', 'เยนญี่ปุ่น'],
];

const CURRENCY_CHARTS: Record<string, string> = {
  USD: 'FX_IDC:USDTHB',
  EUR: 'FX_IDC:EURTHB',
  GBP: 'FX_IDC:GBPTHB',
  CNY: 'FX_IDC:CNYTHB',
  JPY: 'FX_IDC:JPYTHB',
};
const GOLD_CHARTS: Record<string, string> = {
  thai_gold: 'OANDA:XAUUSD',
  comex_gold: 'COMEX:GC1!',
};

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toLocaleDateString('th-TH', { timeZone: 'UTC' });
  }
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
  const [currencySourceId, setCurrencySourceId] = useState('frankfurter');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [goldSourceId, setGoldSourceId] = useState('thai_gold');
  const [chartAsset, setChartAsset] = useState('XAUUSD');
  const [chartInterval, setChartInterval] = useState('D');
  const chartRef = useRef<HTMLDivElement | null>(null);
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

  const currencySources = data?.currency_sources?.length
    ? data.currency_sources
    : data?.currency
      ? [data.currency]
      : [];
  const goldSources = data?.gold_sources?.length
    ? data.gold_sources
    : data?.gold
      ? [data.gold]
      : [];
  const currency =
    currencySources.find((source) => source.id === currencySourceId) ?? currencySources[0];
  const gold = goldSources.find((source) => source.id === goldSourceId) ?? goldSources[0];
  const rates = currency?.rates ?? [];
  const selectedRate = rates.find((rate) => rate.code === currencyCode) ?? rates[0];
  const selectedCurrencyCode = selectedRate?.code ?? currencyCode;
  const chartSymbol =
    chartAsset === 'XAUUSD' || chartAsset === 'comex_gold'
      ? GOLD_CHARTS[chartAsset === 'XAUUSD' ? 'thai_gold' : 'comex_gold']
      : (CURRENCY_CHARTS[chartAsset] ?? CURRENCY_CHARTS.USD);

  useEffect(() => {
    const host = chartRef.current;
    if (loading || !host) return;

    host.replaceChildren();
    const chartContainer = document.createElement('div');
    chartContainer.className = 'tradingview-widget-container__widget h-full w-full';
    host.appendChild(chartContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.text = JSON.stringify({
      autosize: true,
      symbol: chartSymbol,
      interval: chartInterval,
      timezone: 'Asia/Bangkok',
      theme: 'light',
      style: '1',
      locale: 'th',
      allow_symbol_change: false,
      withdateranges: true,
      hide_side_toolbar: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });
    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, [chartSymbol, chartInterval, loading]);

  if (loading && !data) {
    return (
      <div
        className="flex h-full min-h-[300px] items-center justify-center rounded-[18px] border border-black/[0.06] bg-white p-5"
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

  const setIndex = data?.set_index ?? null;
  const setUp = (setIndex?.change ?? 0) >= 0;
  const isGoldChart = chartAsset === 'XAUUSD' || chartAsset === 'comex_gold';

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
                  : currency?.updated_at
                    ? `ข้อมูลอ้างอิง ${formatUpdated(currency.updated_at)}`
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

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* ── Gold ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between rounded-[16px] border border-black/[0.05] bg-gradient-to-b from-[#fbfbfd] to-[#f4f4f6] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#c77700]/10 text-[#c77700]">
              <Coins size={12} aria-hidden="true" />
            </span>
            <label
              htmlFor="market-gold-source"
              className="text-[11px] font-semibold tracking-wide text-[#6e6e73]"
            >
              ทองคำ
            </label>
          </div>
          <MarketSelect
            id="market-gold-source"
            ariaLabel="เลือกแหล่งราคาทอง"
            value={gold?.id ?? goldSourceId}
            onChange={(event) => {
              const sourceId = event.target.value;
              setGoldSourceId(sourceId);
              setChartAsset(sourceId === 'comex_gold' ? 'comex_gold' : 'XAUUSD');
            }}
            className="mt-2.5"
          >
            {goldSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.id === 'comex_gold' ? 'COMEX Gold Futures (USD/oz)' : 'ทองคำแท่งไทย 96.5%'}
              </option>
            ))}
          </MarketSelect>
          {gold ? (
            <>
              {gold.buy != null && gold.sell != null ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-[#6e6e73]">รับซื้อ / บาททองคำ</span>
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
              ) : (
                <div className="mt-2">
                  <div className="tabular-nums text-[20px] font-extrabold leading-none text-[#1d1d1f]">
                    {gold.value != null ? money.format(gold.value) : '—'}
                    <span className="ml-1 text-[10px] font-medium">
                      {gold.currency ?? 'USD'}/oz
                    </span>
                  </div>
                  {gold.change != null && (
                    <div
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                        gold.change >= 0
                          ? 'bg-emerald-100/80 text-emerald-700'
                          : 'bg-red-100/80 text-red-600'
                      }`}
                    >
                      {gold.change >= 0 ? '+' : ''}
                      {gold.change.toFixed(2)} ({gold.change_percent?.toFixed(2)}%)
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 truncate text-[10px] text-[#86868b]" title={gold.updated_at ?? ''}>
                {gold.market || gold.updated_at || 'ราคาล่าสุด'}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12px] text-[#86868b]">ยังไม่มีข้อมูลราคาทอง</p>
          )}
        </div>

        {/* ── SET index ────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between rounded-[16px] border border-black/[0.05] bg-gradient-to-b from-[#fbfbfd] to-[#f4f4f6] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#0066cc]/10 text-[#0066cc]">
              <TrendingUp size={12} aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-[#6e6e73]">ดัชนี SET</span>
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
        <div className="flex flex-col rounded-[16px] border border-black/[0.05] bg-gradient-to-b from-[#fbfbfd] to-[#f4f4f6] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#34c759]/12 text-[#1f9d45]">
              <Banknote size={12} aria-hidden="true" />
            </span>
            <label
              htmlFor="market-currency"
              className="text-[11px] font-semibold tracking-wide text-[#6e6e73]"
            >
              ค่าเงิน
            </label>
          </div>
          <MarketSelect
            id="market-currency"
            ariaLabel="เลือกสกุลเงิน"
            value={selectedCurrencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
            className="mt-2.5"
          >
            {rates.map((rate) => (
              <option key={rate.code} value={rate.code}>
                {rate.code} · {rate.name}
                {rate.unit > 1 ? ` (ต่อ ${rate.unit})` : ''}
              </option>
            ))}
          </MarketSelect>
          {selectedRate ? (
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1">
                <span className="tabular-nums text-[21px] font-extrabold leading-none tracking-tight text-[#1d1d1f]">
                  {money.format(selectedRate.thb)}
                </span>
                <span className="text-[10.5px] font-medium text-[#6e6e73]">บาท</span>
              </div>
              <p className="mt-1.5 text-[10px] text-[#86868b]">
                ต่อ {selectedRate.unit} {selectedRate.code} · {selectedRate.name}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-[#86868b]">ยังไม่มีข้อมูลอัตราแลกเปลี่ยน</p>
          )}
          <label
            htmlFor="market-currency-source"
            className="mt-auto pt-3 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[#a1a1a6]"
          >
            แหล่งข้อมูล
          </label>
          <MarketSelect
            id="market-currency-source"
            ariaLabel="เลือกแหล่งข้อมูลค่าเงิน"
            value={currency?.id ?? ''}
            onChange={(event) => setCurrencySourceId(event.target.value)}
            className="mt-1"
          >
            {currencySources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source}
              </option>
            ))}
          </MarketSelect>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#f5f5f7]/70 px-3 py-2.5 ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="market-chart-asset"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6e6e73]"
          >
            <TrendingUp size={12} aria-hidden="true" />
            กราฟแท่งเทียน
          </label>
          <MarketSelect
            id="market-chart-asset"
            ariaLabel="เลือกสินทรัพย์ในกราฟ"
            value={chartAsset}
            onChange={(event) => setChartAsset(event.target.value)}
          >
            <optgroup label="ทองคำ">
              <option value="XAUUSD">ทองคำ Spot · XAU/USD</option>
              <option value="comex_gold">COMEX Gold Futures</option>
            </optgroup>
            <optgroup label="ค่าเงินเทียบบาท">
              {CURRENCIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code}/THB · {name}
                </option>
              ))}
            </optgroup>
          </MarketSelect>
          <MarketSelect
            ariaLabel="เลือกช่วงเวลาแท่งเทียน"
            value={chartInterval}
            onChange={(event) => setChartInterval(event.target.value)}
          >
            <option value="15">15 นาที</option>
            <option value="60">1 ชั่วโมง</option>
            <option value="D">1 วัน</option>
            <option value="W">1 สัปดาห์</option>
            <option value="M">1 เดือน</option>
          </MarketSelect>
        </div>
        <span className="text-[10px] text-[#86868b]">
          {isGoldChart
            ? 'กราฟ XAU/USD หรือ COMEX ไม่ใช่ราคาทองแท่งไทย'
            : 'ข้อมูลกราฟจาก TradingView'}
        </span>
      </div>
      <div
        ref={chartRef}
        className="tradingview-widget-container mt-2 h-[280px] w-full overflow-hidden rounded-[14px] bg-white ring-1 ring-black/[0.06] sm:h-[320px]"
        aria-label={`กราฟแท่งเทียน ${chartSymbol}`}
      />

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#475569]">
        <span>
          อัตราค่าเงิน:{' '}
          <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer" className="underline">
            Frankfurter
          </a>
          {' · กราฟจาก TradingView · ทองแท่งไทยจากสมาคมค้าทองคำ'}
        </span>
        {refreshing && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
      </div>
    </section>
  );
}
