'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  HardDrive,
  Loader2,
  MemoryStick,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { SectionCard } from '@/components/Profile/SectionCard';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface ServiceStatus {
  status: string;
  latency_ms?: number | null;
  detail?: string | null;
}

/** Mirror of the backend `SystemHealth` response model. */
interface SystemHealth {
  uptime_seconds: number;
  database: ServiceStatus;
  cpu_percent: number;
  memory_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_percent: number;
}

const STATUS_META: Record<string, { label: string; badge: string; value: string }> = {
  ok: {
    label: 'ปกติ',
    badge: 'bg-[#248a3d]/10 text-[#248a3d] ring-[#248a3d]/20',
    value: 'text-[#248a3d]',
  },
  degraded: {
    label: 'ทำงานช้า',
    badge: 'bg-[#b25000]/10 text-[#b25000] ring-[#b25000]/20',
    value: 'text-[#b25000]',
  },
  down: {
    label: 'ขัดข้อง',
    badge: 'bg-[#ff3b30]/10 text-[#b42318] ring-[#ff3b30]/20',
    value: 'text-[#b42318]',
  },
};

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 });

/** `uptime_seconds` is unreadable raw, so show the two largest units. */
function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${minutes} น.`;
  return `${minutes} น.`;
}

function formatMegabytesAsGigabytes(mb: number): string {
  return numberFormat.format(mb / 1024);
}

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.down;
}

function Metric({
  icon,
  label,
  value,
  valueClassName,
  hint,
  percent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
  percent?: number;
}) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 text-[22px] font-extrabold leading-none tabular-nums ${valueClassName ?? 'text-[#1d1d1f]'}`}
      >
        {value}
      </p>
      {percent !== undefined && (
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#f2f2f7]"
          role="presentation"
        >
          <div
            className={`h-full rounded-full ${
              percent >= 90 ? 'bg-[#ff3b30]' : percent >= 70 ? 'bg-[#ff9500]' : 'bg-[#0066cc]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-1 text-[11px] text-[#a1a1a6]">{hint}</p>}
    </div>
  );
}

/**
 * Live resource health for the box the API runs on.
 *
 * `/system/health` is admin-only server-side, so this card is just the read
 * view: it never decides who may see the numbers, it only renders them.
 */
export function SystemHealthCard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/system/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SystemHealth;
      setHealth(data);
      setError(null);
      setUpdatedAt(new Date());
    } catch {
      setError('ดึงสถานะระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const database = health ? statusMeta(health.database.status) : null;

  return (
    <SectionCard
      icon={<Activity size={19} aria-hidden="true" />}
      iconBg="bg-emerald-50"
      iconColor="text-emerald-600"
      iconRing="ring-emerald-200/60"
      title="สุขภาพระบบ"
      subtitle="ทรัพยากรของเซิร์ฟเวอร์และสถานะฐานข้อมูล"
      action={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="รีเฟรชสถานะระบบ"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#1d1d1f] shadow-xs ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={loading ? 'animate-spin' : undefined}
          />
          {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
        </button>
      }
    >
      {error && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#ff3b30]/[0.07] px-3.5 py-2.5">
          <p
            role="alert"
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b42318]"
          >
            <AlertTriangle size={14} aria-hidden="true" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#b42318] ring-1 ring-[#ff3b30]/20 transition-colors hover:bg-[#fff5f5] disabled:opacity-50"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {!health ? (
        !error && (
          <div
            className="flex min-h-[132px] items-center justify-center"
            role="status"
            aria-label="กำลังโหลดสถานะระบบ"
          >
            <Loader2 size={20} className="animate-spin text-[#86868b]" aria-hidden="true" />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                <Database size={13} aria-hidden="true" />
                ฐานข้อมูล
              </p>
              <p
                className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ${database?.badge}`}
              >
                {database?.label}
              </p>
              <p className="mt-1 text-[11px] text-[#a1a1a6]">
                {health.database.latency_ms != null
                  ? `ตอบสนอง ${numberFormat.format(health.database.latency_ms)} ms`
                  : (health.database.detail ?? 'ไม่มีข้อมูลเวลาตอบสนอง')}
              </p>
            </div>

            <Metric
              icon={<Timer size={13} aria-hidden="true" />}
              label="เวลาทำงานต่อเนื่อง"
              value={formatUptime(health.uptime_seconds)}
              hint="นับตั้งแต่เริ่มกระบวนการของ API"
            />

            <Metric
              icon={<Activity size={13} aria-hidden="true" />}
              label="การใช้งาน CPU"
              value={`${Math.round(health.cpu_percent)}%`}
              percent={health.cpu_percent}
              hint="ค่าเฉลี่ยช่วงสั้นจากการอ่านล่าสุด"
            />

            <Metric
              icon={<MemoryStick size={13} aria-hidden="true" />}
              label="หน่วยความจำ"
              value={`${Math.round(health.memory_percent)}%`}
              percent={health.memory_percent}
              hint={`ใช้ไป ${formatMegabytesAsGigabytes(health.memory_used_mb)} จาก ${formatMegabytesAsGigabytes(health.memory_total_mb)} GB`}
            />

            <Metric
              icon={<HardDrive size={13} aria-hidden="true" />}
              label="พื้นที่ดิสก์"
              value={`${Math.round(health.disk_percent)}%`}
              percent={health.disk_percent}
              hint="ใช้งานแล้วบนพาร์ทิชันหลัก"
            />
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-[#a1a1a6]">
            <Timer size={11} aria-hidden="true" />
            {updatedAt
              ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString('th-TH')} — กดรีเฟรชเพื่อดูค่าใหม่`
              : 'กดรีเฟรชเพื่อดูค่าใหม่'}
          </p>
        </>
      )}
    </SectionCard>
  );
}

export default SystemHealthCard;
