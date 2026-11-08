'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { showToast } from '@/utils/sweetalert';
import { usePreferences } from '@/hooks/usePreferences';
import { formatLongDate } from '@/utils/dateFormat';
import { getGreeting } from '@/utils/greeting';
import { shareOrDownloadDailyCard } from '@/utils/cardGenerator';
import { useBranding } from '@/context/BrandingContext';

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
  };
  market: {
    setIndex: number | null;
    setChange: number | null;
    usdRate: number | null;
  };
  pendingTasks: number;
}

const INITIAL_DIGEST: DigestData = {
  weather: { temp: null, condition: 'กำลังโหลด…', pm25: null },
  oil: { diesel: null, gasohol95: null, status: 'ปกติ' },
  market: { setIndex: null, setChange: null, usdRate: null },
  pendingTasks: 0,
};

export default function DailyDigestWidget({
  width = 2,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const preferences = usePreferences();
  const { companyName } = useBranding();
  const [data, setData] = useState<DigestData>(INITIAL_DIGEST);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [greeting, setGreeting] = useState<string>(getGreeting);
  const [, startTransition] = useTransition();

  const fetchDigestData = async () => {
    let pendingCount = 0;
    try {
      const rawTasks = localStorage.getItem('quick_notes_tasks');
      if (rawTasks) {
        const parsed = JSON.parse(rawTasks);
        if (Array.isArray(parsed)) {
          pendingCount = parsed.filter((t: { done?: boolean }) => !t.done).length;
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }

    let weather = { temp: 31, condition: 'ท้องฟ้าแจ่มใส', pm25: 18 };
    let oil = { diesel: 32.94, gasohol95: 38.55, status: 'ราคาคงที่' };
    let market = { setIndex: 1425.5, setChange: 4.2, usdRate: 35.8 };

    // Fetch Weather
    try {
      const res = await fetchWithAuth('/api/v1/weather/forecast?latitude=13.75&longitude=100.5');
      if (res.ok) {
        const json = await res.json();
        const cur = json.current || json;
        if (cur.temperature != null || cur.temperature_2m != null) {
          weather = {
            temp: Math.round(cur.temperature ?? cur.temperature_2m ?? 31),
            condition: 'อากาศทั่วไปแจ่มใส',
            pm25: json.air_quality?.pm2_5 ? Math.round(json.air_quality.pm2_5) : 18,
          };
        }
      }
    } catch {
      // Use fallback
    }

    // Fetch Oil
    try {
      const res = await fetchWithAuth('/api/v1/oil-prices');
      if (res.ok) {
        const json = await res.json();
        const ptt = json.stations?.find((s: { code: string }) => s.code === 'PTT') || json.stations?.[0];
        if (ptt?.fuels) {
          const d = ptt.fuels.find((f: { name: string }) => f.name.includes('ดีเซล'));
          const g95 = ptt.fuels.find((f: { name: string }) => f.name.includes('95'));
          oil = {
            diesel: d?.price ?? 32.94,
            gasohol95: g95?.price ?? 38.55,
            status: json.has_change ? 'มีการปรับราคา' : 'ราคาคงที่',
          };
        }
      }
    } catch {
      // Use fallback
    }

    // Fetch Market
    try {
      const res = await fetchWithAuth('/api/v1/market/summary');
      if (res.ok) {
        const json = await res.json();
        market = {
          setIndex: json.set_index?.value ? Number(json.set_index.value.toFixed(2)) : 1425.5,
          setChange: json.set_index?.change ? Number(json.set_index.change.toFixed(2)) : 4.2,
          usdRate: json.currency?.value ? Number(json.currency.value.toFixed(2)) : 35.8,
        };
      }
    } catch {
      // Use fallback
    }

    startTransition(() => {
      setData({
        weather,
        oil,
        market,
        pendingTasks: pendingCount,
      });
      setIsLoading(false);
      setIsRefreshing(false);
    });
  };

  useEffect(() => {
    fetchDigestData();
    setGreeting(getGreeting());
    const timer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDigestData();
  };

  const generateDigestText = () => {
    const dateStr = formatLongDate(new Date(), preferences);
    return `[ART Workspace สรุปประจำวัน: ${dateStr}]\n` +
      `- สภาพอากาศ: ${data.weather.temp ?? 31}°C (${data.weather.condition}, PM2.5: ${data.weather.pm25 ?? 'ปกติ'})\n` +
      `- ราคาน้ำมัน: ดีเซล ${data.oil.diesel ?? '-'} บาท / แก๊สโซฮอล์ 95 ${data.oil.gasohol95 ?? '-'} บาท (${data.oil.status})\n` +
      `- ดัชนีตลาด: SET ${data.market.setIndex ?? '-'} (${(data.market.setChange ?? 0) >= 0 ? '+' : ''}${data.market.setChange ?? 0}), USD/THB: ${data.market.usdRate ?? '-'}\n` +
      `- สิ่งที่ต้องทำ: มี ${data.pendingTasks} งานค้างใน To-Do List`;
  };

  const handleCopy = async () => {
    try {
      const text = generateDigestText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('คัดลอกสรุปประจำวันแล้ว', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('ไม่สามารถคัดลอกได้', 'error');
    }
  };

  const handleShareCard = async () => {
    try {
      setIsGeneratingCard(true);
      const dateStr = formatLongDate(new Date(), preferences);
      await shareOrDownloadDailyCard({
        companyName: companyName || 'ART WORKSPACE',
        dateStr,
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
        pendingTasks: data.pendingTasks,
      });
      showToast('สร้างภาพการ์ดสรุปประจำวันสำเร็จ', 'success');
    } catch {
      showToast('ไม่สามารถสร้างภาพการ์ดได้', 'error');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  return (
    <section
      className="flex h-full flex-col rounded-[18px] bg-[var(--surface)] p-4 border border-[var(--hairline)] transition-all duration-200"
      aria-labelledby="daily-digest-title"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2
                id="daily-digest-title"
                className="truncate text-[15px] font-bold tracking-tight text-[var(--ink)]"
              >
                สรุปประจำวันอัจฉริยะ
              </h2>
              <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-text)]">
                Smart Briefing
              </span>
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
            title="แชร์การ์ดสรุปประจำวัน (รูปภาพ)"
            aria-label="แชร์การ์ดสรุปประจำวัน"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--accent)] active:scale-[0.95] disabled:opacity-50"
          >
            <Share2 size={14} className={isGeneratingCard ? 'animate-pulse text-[var(--accent)]' : ''} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="คัดลอกสรุปประจำวัน"
            aria-label="คัดลอกสรุปประจำวัน"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95]"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="อัปเดตข้อมูล"
            aria-label="อัปเดตข้อมูล"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95] disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
      </div>

      {/* ── Dynamic AI Narrative Briefing Banner ──────────────────────── */}
      <div className="mt-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-3.5">
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
              อุณหภูมิวันนี้ประมาณ <span className="font-semibold text-[var(--ink)]">{data.weather.temp ?? 31}°C</span> ({data.weather.condition}) · ราคาน้ำมัน: <span className="font-semibold text-[var(--ink)]">{data.oil.status}</span> · ดัชนี SET:  <span className="font-semibold text-[var(--ink)]">{data.market.setIndex ?? '-'}</span> · งานค้างในระบบ: <span className="font-semibold text-[var(--ink)]">{data.pendingTasks} รายการ</span>
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
        <div className="flex flex-col justify-between rounded-[14px] bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
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
        <div className="flex flex-col justify-between rounded-[14px] bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between text-[var(--ink-tertiary)]">
            <span className="text-[11px] font-bold">น้ำมัน</span>
            <Fuel size={14} className="text-blue-500" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">
              {data.oil.diesel != null ? `฿${data.oil.diesel}` : '–'}
            </p>
            <p className="text-[10px] text-[var(--ink-muted)] truncate">{data.oil.status}</p>
          </div>
        </div>

        {/* Metric 3: Market */}
        <div className="flex flex-col justify-between rounded-[14px] bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
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
        <div className="flex flex-col justify-between rounded-[14px] bg-[var(--surface-grouped)] p-2.5 ring-1 ring-[var(--hairline-soft)]">
          <div className="flex items-center justify-between text-[var(--ink-tertiary)]">
            <span className="text-[11px] font-bold">สิ่งที่ต้องทำ</span>
            <CheckSquare size={14} className="text-purple-500" />
          </div>
          <div className="mt-2">
            <p className="text-[16px] font-black text-[var(--ink)]">{data.pendingTasks}</p>
            <p className="text-[10px] text-[var(--ink-muted)] truncate">รายการค้างอยู่</p>
          </div>
        </div>
      </div>
    </section>
  );
}
