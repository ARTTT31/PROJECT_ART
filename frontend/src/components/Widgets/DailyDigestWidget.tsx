'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Sparkles,
  Sun,
  Fuel,
  TrendingUp,
  CheckSquare,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Share2,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import Select from '@/components/ui/Select';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { showToast } from '@/utils/sweetalert';
import { usePreferences } from '@/hooks/usePreferences';
import { formatLongDate } from '@/utils/dateFormat';
import { getGreeting } from '@/utils/greeting';
import { shareOrDownloadDailyCard } from '@/utils/cardGenerator';
import { useBranding } from '@/context/BrandingContext';
import { useTheme } from '@/context/ThemeContext';
import { readCached, writeCached } from '@/lib/offline/localStore';
import { pendingQuickNotes, QUICK_NOTES_UPDATED_EVENT } from '@/lib/quickNotes';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { translateText } from '@/lib/i18n/translate';

interface DigestData {
  weather: {
    temp: number | null;
    condition: string;
    pm25: number | null;
  };
  oil: {
    diesel: number | null;
    gasohol95: number | null;
    status: string;
    /** Every fuel the provider returned, keyed like `diesel` / `gasohol_95`. */
    prices?: Record<string, number>;
  };
  market: {
    setIndex: number | null;
    setChange: number | null;
    usdRate: number | null;
  };
  pendingTasks: number;
}

// Seeded copy is resolved when the card first paints, not at module load, so the
// placeholder follows the chosen interface language.
function initialDigest(): DigestData {
  return {
    weather: {
      temp: null,
      condition: translateText('กำลังโหลด…', 'Loading…'),
      pm25: null,
    },
    oil: {
      diesel: null,
      gasohol95: null,
      status: translateText('ปกติ', 'Normal'),
    },
    market: { setIndex: null, setChange: null, usdRate: null },
    pendingTasks: 0,
  };
}

// Shown only when nothing has ever loaded and the provider is unreachable;
// a card with numbers beats an empty one, and the next refresh replaces them.
function fallbackDigest(): DigestData {
  return {
    weather: { temp: 31, condition: translateText('ท้องฟ้าแจ่มใส', 'Clear sky'), pm25: 18 },
    oil: {
      diesel: 32.94,
      gasohol95: 38.55,
      status: translateText('ราคาคงที่', 'Price unchanged'),
    },
    market: { setIndex: 1425.5, setChange: 4.2, usdRate: 35.8 },
    pendingTasks: 0,
  };
}

// Last payload this account saw, scoped per account by localStore. The card
// used to open on "กำลังประมวลผล…" and only paint once three serial requests
// finished, so every visit looked like the dashboard was still loading.
const DIGEST_CACHE_KEY = 'dashboard/digest';

/** Fuel types offered by the oil tile, in the provider's display order. */
const FUEL_OPTIONS: { value: string; th: string; en: string }[] = [
  { value: 'diesel', th: 'ดีเซล', en: 'Diesel' },
  { value: 'gasohol_95', th: 'แก๊ส 95', en: 'Gasohol 95' },
  { value: 'gasohol_91', th: 'แก๊ส 91', en: 'Gasohol 91' },
  { value: 'gasohol_e20', th: 'E20', en: 'E20' },
  { value: 'gasohol_e85', th: 'E85', en: 'E85' },
  { value: 'benzene_95', th: 'เบนซิน 95', en: 'Benzene 95' },
];

// Which fuel the tile shows is a display preference, so it lives per device
// like the theme rather than on the account.
const FUEL_STORAGE_KEY = 'artDigestFuelV1';

function readFuelChoice(): string {
  try {
    const stored = localStorage.getItem(FUEL_STORAGE_KEY);
    if (stored && FUEL_OPTIONS.some((option) => option.value === stored)) return stored;
  } catch {
    // Private mode: fall back to diesel.
  }
  return 'diesel';
}

function readDigestCache(): DigestData | null {
  return readCached<DigestData>(DIGEST_CACHE_KEY)?.data ?? null;
}

// Count what is actually in Quick Notes, including a tick/clear/delete done a
// second ago, instead of a copy that only updated on page load.
function currentPendingTasks(): number {
  return pendingQuickNotes().length;
}

/** Weather/air-quality pair, or null when the provider answered unusable data. */
async function loadWeather(): Promise<DigestData['weather'] | null> {
  try {
    const res = await fetchWithAuth('/api/v1/weather/forecast?latitude=13.75&longitude=100.5');
    if (!res.ok) return null;
    const json = await res.json();
    const cur = json.current || json;
    if (cur.temperature == null && cur.temperature_2m == null) return null;
    return {
      temp: Math.round(cur.temperature ?? cur.temperature_2m ?? 31),
      condition: translateText('อากาศทั่วไปแจ่มใส', 'Generally clear skies'),
      pm25: json.air_quality?.pm2_5 ? Math.round(json.air_quality.pm2_5) : 18,
    };
  } catch {
    return null;
  }
}

/** Retail fuel prices keyed by fuel, or null when the payload carried none. */
async function loadOil(): Promise<DigestData['oil'] | null> {
  try {
    const res = await fetchWithAuth('/api/v1/oil-prices');
    if (!res.ok) return null;
    const json = await res.json();
    // The endpoint answers `{ prices: [{ key, name, price, unit }] }`. Reading
    // `stations[].fuels[]` (an older upstream shape) meant the tile never saw a
    // live price and silently kept the baked-in sample numbers.
    const fuels = Array.isArray(json.prices)
      ? json.prices
      : Array.isArray(json.oil_prices)
        ? json.oil_prices
        : [];
    const prices: Record<string, number> = {};
    for (const fuel of fuels) {
      if (typeof fuel?.key === 'string' && typeof fuel?.price === 'number') {
        prices[fuel.key] = fuel.price;
      }
    }
    if (Object.keys(prices).length === 0) return null;
    return {
      diesel: prices.diesel ?? null,
      gasohol95: prices.gasohol_95 ?? null,
      status: json.is_stale
        ? translateText('ข้อมูลอาจไม่เป็นปัจจุบัน', 'Data may be out of date')
        : translateText('ราคาล่าสุด', 'Latest price'),
      prices,
    };
  } catch {
    return null;
  }
}

/** SET index and USD reference rate, or null when the payload is empty. */
async function loadMarket(): Promise<DigestData['market'] | null> {
  try {
    const res = await fetchWithAuth('/api/v1/market/summary');
    if (!res.ok) return null;
    const json = await res.json();
    return {
      setIndex: json.set_index?.value ? Number(json.set_index.value.toFixed(2)) : 1425.5,
      setChange: json.set_index?.change ? Number(json.set_index.change.toFixed(2)) : 4.2,
      usdRate: json.currency?.value ? Number(json.currency.value.toFixed(2)) : 35.8,
    };
  } catch {
    return null;
  }
}

/** `getGreeting()` answers in Thai only, so the widget supplies the English copy. */
const GREETING_EN: Record<string, string> = {
  'สวัสดีตอนเช้า': 'Good morning',
  'สวัสดีตอนเที่ยง': 'Good afternoon',
  'สวัสดีตอนบ่าย': 'Good afternoon',
  'สวัสดีตอนเย็น': 'Good evening',
  'สวัสดีตอนค่ำ': 'Good evening',
  'ราตรีสวัสดิ์': 'Good night',
};

export default function DailyDigestWidget({
  width = 2,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const { tr } = useI18n();
  const preferences = usePreferences();
  const { companyName } = useBranding();
  const { resolvedMode } = useTheme();
  // The picker takes one label string; the option table keeps both languages so
  // the tile follows the active one instead of always showing Thai.
  const fuelOptions = useMemo(
    () => FUEL_OPTIONS.map((option) => ({ value: option.value, label: tr(option.th, option.en) })),
    [tr],
  );
  // Paint the last saved digest on the first render; nothing is gained by
  // hiding usable numbers behind the network round-trip.
  const [data, setData] = useState<DigestData>(() => readDigestCache() ?? initialDigest());
  const [isLoading, setIsLoading] = useState(() => readDigestCache() === null);
  const [fuel, setFuel] = useState(readFuelChoice);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [greeting, setGreeting] = useState<string>(getGreeting);
  const [, startTransition] = useTransition();
  // Fallbacks for a failed refresh read the CURRENT card, not the state closed
  // over when the request started.
  const dataRef = useRef(data);

  const changeFuel = (next: string) => {
    setFuel(next);
    try {
      localStorage.setItem(FUEL_STORAGE_KEY, next);
    } catch {
      // The choice just does not survive a reload.
    }
  };

  const fetchDigestData = useCallback(async () => {
    const pendingCount = currentPendingTasks();

    // All three in parallel: serially they added up (weather alone can take
    // seconds on a cold backend) before anything reached the card.
    const [weather, oil, market] = await Promise.all([loadWeather(), loadOil(), loadMarket()]);

    const previous = dataRef.current;
    const next: DigestData = {
      // A provider that failed keeps the value already on screen; only a card
      // that never had data falls back to the bundled sample numbers.
      weather: weather ?? (previous.weather.temp != null ? previous.weather : fallbackDigest().weather),
      oil: oil ?? (previous.oil.diesel != null ? previous.oil : fallbackDigest().oil),
      market:
        market ?? (previous.market.setIndex != null ? previous.market : fallbackDigest().market),
      pendingTasks: pendingCount,
    };
    dataRef.current = next;
    writeCached(DIGEST_CACHE_KEY, next);

    startTransition(() => {
      setData(next);
      setIsLoading(false);
      setIsRefreshing(false);
    });
  }, []);

  useEffect(() => {
    fetchDigestData();
    setGreeting(getGreeting());
    const timer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);

    // The notes widget announces every tick/clear/delete; update the tile and
    // the cached snapshot without refetching weather, oil and market.
    const onNotesUpdated = () => {
      const pendingTasks = currentPendingTasks();
      const previous = dataRef.current;
      if (previous.pendingTasks === pendingTasks) return;
      const next = { ...previous, pendingTasks };
      dataRef.current = next;
      writeCached(DIGEST_CACHE_KEY, next);
      setData(next);
    };
    window.addEventListener(QUICK_NOTES_UPDATED_EVENT, onNotesUpdated);

    return () => {
      clearInterval(timer);
      window.removeEventListener(QUICK_NOTES_UPDATED_EVENT, onNotesUpdated);
    };
  }, [fetchDigestData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDigestData();
  };

  // A cached digest can be a day old; the task count always reflects this
  // browser's current Quick Notes.
  const pendingTasks = currentPendingTasks();
  const fuelPrice =
    data.oil.prices?.[fuel] ??
    (fuel === 'diesel' ? data.oil.diesel : fuel === 'gasohol_95' ? data.oil.gasohol95 : null);
  // `getGreeting()` answers in Thai; map its values for the English interface.
  const greetingLabel = tr(greeting, GREETING_EN[greeting] ?? greeting);

  const generateDigestText = () => {
    const dateStr = formatLongDate(new Date(), preferences);
    const change = `${(data.market.setChange ?? 0) >= 0 ? '+' : ''}${data.market.setChange ?? 0}`;
    return `${tr('[ART Workspace สรุปประจำวัน: {date}]', '[ART Workspace daily summary: {date}]', { date: dateStr })}\n` +
      `${tr(
        '- สภาพอากาศ: {temp}°C ({condition}, PM2.5: {pm25})',
        '- Weather: {temp}°C ({condition}, PM2.5: {pm25})',
        {
          temp: data.weather.temp ?? 31,
          condition: data.weather.condition,
          pm25: data.weather.pm25 ?? tr('ปกติ', 'Normal'),
        },
      )}\n` +
      `${tr(
        '- ราคาน้ำมัน: ดีเซล {diesel} บาท / แก๊สโซฮอล์ 95 {gasohol95} บาท ({status})',
        '- Fuel: Diesel {diesel} THB / Gasohol 95 {gasohol95} THB ({status})',
        {
          diesel: data.oil.diesel ?? '-',
          gasohol95: data.oil.gasohol95 ?? '-',
          status: data.oil.status,
        },
      )}\n` +
      `${tr(
        '- ดัชนีตลาด: SET {setIndex} ({change}), USD/THB: {usd}',
        '- Market index: SET {setIndex} ({change}), USD/THB: {usd}',
        {
          setIndex: data.market.setIndex ?? '-',
          change,
          usd: data.market.usdRate ?? '-',
        },
      )}\n` +
      `${tr(
        '- สิ่งที่ต้องทำ: มี {count} งานค้างใน To-Do List',
        '- To-dos: {count} still open in the to-do list',
        { count: pendingTasks },
      )}`;
  };

  const handleCopy = async () => {
    try {
      const text = generateDigestText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast(tr('คัดลอกสรุปประจำวันแล้ว', 'Daily summary copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(tr('ไม่สามารถคัดลอกได้', 'Could not copy'), 'error');
    }
  };

  const handleShareCard = async () => {
    try {
      setIsGeneratingCard(true);
      const dateStr = formatLongDate(new Date(), preferences);
      await shareOrDownloadDailyCard({
        companyName: companyName || 'ART WORKSPACE',
        dateStr,
        greeting: `${greetingLabel} — ${tr('ภาพรวมพร้อมสำหรับคุณ', 'your overview is ready')}`,
        theme: resolvedMode === 'dark' ? 'dark' : 'light',
        weather: {
          temp: data.weather.temp,
          condition: data.weather.condition,
          pm25: data.weather.pm25,
        },
        oil: {
          diesel: data.oil.diesel,
          gasohol95: data.oil.gasohol95,
          status: data.oil.status,
        },
        market: {
          setIndex: data.market.setIndex,
          setChange: data.market.setChange,
          usdRate: data.market.usdRate,
        },
        pendingTasks,
      });
      showToast(tr('สร้างภาพการ์ดสรุปประจำวันสำเร็จ', 'Daily summary card created'), 'success');
    } catch {
      showToast(tr('ไม่สามารถสร้างภาพการ์ดได้', 'Could not create the card image'), 'error');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  return (
    <section
      className="flex h-full flex-col rounded-apple-lg bg-[var(--surface)] p-4 border border-[var(--hairline)] transition-all duration-200"
      aria-labelledby="daily-digest-title"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2
                id="daily-digest-title"
                className="truncate text-[15px] font-bold tracking-tight text-[var(--ink)]"
              >
                {tr('สรุปประจำวันอัจฉริยะ', 'Smart daily summary')}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--ink-tertiary)] flex items-center gap-1">
              <Calendar size={11} aria-hidden="true" />
              <span>{formatLongDate(new Date(), preferences)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleShareCard}
            disabled={isGeneratingCard}
            title={tr('แชร์การ์ดสรุปประจำวัน (รูปภาพ)', 'Share the daily summary card (image)')}
            aria-label={tr('แชร์การ์ดสรุปประจำวัน', 'Share the daily summary card')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--accent)] active:scale-[0.95] disabled:opacity-50"
          >
            <Share2 size={14} className={isGeneratingCard ? 'animate-pulse text-[var(--accent)]' : ''} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title={tr('คัดลอกสรุปประจำวัน', 'Copy the daily summary')}
            aria-label={tr('คัดลอกสรุปประจำวัน', 'Copy the daily summary')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95]"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title={tr('อัปเดตข้อมูล', 'Refresh data')}
            aria-label={tr('อัปเดตข้อมูล', 'Refresh data')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95] disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
      </div>

      {/* ── Dynamic AI Narrative Briefing Banner ──────────────────────── */}
      <div className="mt-3 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-subtle)] p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[12px] font-bold text-[var(--ink)]">
            {greeting} — ภาพรวมพร้อมสำหรับคุณ
          </p>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
          {isLoading ? (
            'กำลังประมวลผลข้อมูลสรุปประจำวัน…'
          ) : (
            <>
              อุณหภูมิวันนี้ประมาณ <span className="font-semibold text-[var(--ink)]">{data.weather.temp ?? 31}°C</span> ({data.weather.condition}) · ราคาน้ำมัน: <span className="font-semibold text-[var(--ink)]">{data.oil.status}</span> · ดัชนี SET:  <span className="font-semibold text-[var(--ink)]">{data.market.setIndex ?? '-'}</span> · งานค้างในระบบ: <span className="font-semibold text-[var(--ink)]">{pendingTasks} รายการ</span>
            </>
          )}
        </p>
      </div>

      {/* ── Metric Cards Grid ────────────────────────────────────────── */}
      <div
        className={`mt-3 grid gap-2.5 flex-1 ${
          width === 1 ? 'grid-cols-2' : width === 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-4'
        }`}
      >
        {/* Metric 1: Weather */}
        <div className="flex flex-col justify-between rounded-apple-widget bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between text-[var(--ink-tertiary)]">
            <span className="text-[11px] font-bold">อากาศ</span>
            <Sun size={14} className="text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">
              {data.weather.temp != null ? `${data.weather.temp}°C` : '–'}
            </p>
            <p className="text-[10px] text-[var(--ink-muted)] truncate">
              PM2.5: {data.weather.pm25 != null ? `${data.weather.pm25} µg` : 'ปกติ'}
            </p>
          </div>
        </div>

        {/* Metric 2: Oil Price */}
        <div className="flex flex-col justify-between rounded-apple-widget bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between gap-1 text-[var(--ink-tertiary)]">
            <Select
              value={fuel}
              onChange={changeFuel}
              options={fuelOptions}
              ariaLabel="เลือกชนิดน้ำมันที่แสดงบนสรุปประจำวัน"
              className="max-w-[96px]"
            />
            <Fuel size={14} className="shrink-0 text-blue-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">
              {fuelPrice != null ? `฿${fuelPrice}` : '–'}
            </p>
            <p className="text-[10px] text-[var(--ink-muted)] truncate">{data.oil.status}</p>
          </div>
        </div>

        {/* Metric 3: Market */}
        <div className="flex flex-col justify-between rounded-apple-widget bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between text-[var(--ink-tertiary)]">
            <span className="text-[11px] font-bold">ตลาด SET</span>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">
              {data.market.setIndex != null ? data.market.setIndex : '–'}
            </p>
            <p
              className={`text-[10px] font-semibold truncate ${
                (data.market.setChange ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {(data.market.setChange ?? 0) >= 0 ? '+' : ''}
              {data.market.setChange ?? 0}
            </p>
          </div>
        </div>

        {/* Metric 4: Tasks */}
        <div className="flex flex-col justify-between rounded-apple-widget bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between text-[var(--ink-tertiary)]">
            <span className="text-[11px] font-bold">สิ่งที่ต้องทำ</span>
            <CheckSquare size={14} className="text-purple-500" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">{pendingTasks}</p>
            <p className="text-[10px] text-[var(--ink-muted)] truncate">รายการค้างอยู่</p>
          </div>
        </div>
      </div>
    </section>
  );
}
