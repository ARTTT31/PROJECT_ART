'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, RefreshCw, Wallet } from 'lucide-react';
import Select from '@/components/ui/Select';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface CurrencyRate {
  code: string;
  name: string;
  unit: number;
  thb: number;
}

interface MarketSummary {
  currency: { rates: CurrencyRate[] } | null;
}

// Shared across mounts: the daily reference rates change at most once a day,
// so reopening the dashboard should not hit the API again.
let ratesCache: CurrencyRate[] | null = null;

const THB_CODE = 'THB';
const numberFormat = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function CurrencyConverterWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [rates, setRates] = useState<CurrencyRate[]>(() => ratesCache ?? []);
  const [loading, setLoading] = useState(() => ratesCache === null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('THB');
  const [to, setTo] = useState('USD');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/v1/market/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MarketSummary;
      const loaded = Array.isArray(data.currency?.rates) ? data.currency!.rates : [];
      ratesCache = loaded;
      setRates(loaded);
    } catch {
      setError('โหลดอัตราแลกเปลี่ยนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ratesCache === null) void load();
  }, [load]);

  /** Baht per one unit of `code` (THB itself is 1). */
  const bahtPerUnit = useMemo(() => {
    const map = new Map<string, number>([[THB_CODE, 1]]);
    rates.forEach((rate) => map.set(rate.code, rate.thb / (rate.unit || 1)));
    return map;
  }, [rates]);

  const options = useMemo(
    () => [
      { code: THB_CODE, name: 'บาทไทย' },
      ...rates.map((rate) => ({ code: rate.code, name: rate.name })),
    ],
    [rates],
  );

  const numericAmount = Number.parseFloat(amount.replace(/,/g, '')) || 0;
  const fromRate = bahtPerUnit.get(from) ?? 1;
  const toRate = bahtPerUnit.get(to) ?? 1;
  const converted = toRate > 0 ? (numericAmount * fromRate) / toRate : 0;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="currency-converter-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--info-soft)] text-[#0f7c8f]">
            <Wallet size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="currency-converter-title"
              className="truncate text-[16px] font-bold tracking-tight text-[var(--ink)]"
            >
              แปลงสกุลเงิน
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-tertiary)]">
              ใช้อัตราอ้างอิงรายวันจากธนาคารกลาง
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">จำนวน</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="จำนวนเงินที่ต้องการแปลง"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">จาก</span>
            <Select
              value={from}
              onChange={setFrom}
              ariaLabel="สกุลเงินต้นทาง"
              size="md"
              options={options.map((option) => ({ value: option.code, label: option.code }))}
              className="w-full"
            />
          </div>

          <button
            type="button"
            onClick={swap}
            aria-label="สลับสกุลเงิน"
            className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-grouped-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]"
          >
            <ArrowLeftRight size={15} aria-hidden="true" />
          </button>

          <div className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">เป็น</span>
            <Select
              value={to}
              onChange={setTo}
              ariaLabel="สกุลเงินปลายทาง"
              size="md"
              options={options.map((option) => ({ value: option.code, label: option.code }))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-center rounded-[16px] bg-[var(--surface-grouped)] px-4 py-3.5">
        {loading ? (
          <div role="status" className="flex items-center justify-center py-2">
            <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" aria-hidden="true" />
          </div>
        ) : error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[var(--danger-ink)]"
          >
            <RefreshCw size={13} aria-hidden="true" /> {error} — ลองใหม่
          </button>
        ) : (
          <>
            <span className="text-[11.5px] font-medium text-[var(--ink-muted)]">
              {numberFormat.format(numericAmount)} {from} =
            </span>
            <span className="mt-0.5 tabular-nums text-[24px] font-extrabold leading-tight text-[var(--ink)]">
              {numberFormat.format(converted)}{' '}
              <span className="text-[13px] font-semibold text-[var(--ink-muted)]">{to}</span>
            </span>
            <span className="mt-1 text-[11px] text-[var(--ink-tertiary)]">
              1 {to} ≈ {numberFormat.format(toRate / (fromRate || 1))} {from}
            </span>
          </>
        )}
      </div>

      <p className="mt-3 border-t border-[var(--hairline-soft)] pt-2 text-[10px] text-[var(--ink-secondary)]">
        อัตราอ้างอิงจาก Frankfurter · ข้อมูลรายวัน ไม่ใช่ราคาซื้อขายจริงของธนาคาร
      </p>
    </section>
  );
}
