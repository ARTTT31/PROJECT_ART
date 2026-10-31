'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';

const money = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Parse a typed amount; blank and malformed input both mean "not filled in". */
function toNumber(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function PriceCalcWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');

  const result = useMemo(() => {
    const costValue = toNumber(cost);
    const priceValue = toNumber(price);
    // A discount outside 0–100 makes no sense; clamp instead of showing a
    // negative selling price.
    const discountValue = Math.min(100, Math.max(0, toNumber(discount)));

    const net = priceValue * (1 - discountValue / 100);
    const profit = net - costValue;
    const margin = net > 0 ? (profit / net) * 100 : 0;
    const hasInput = costValue > 0 || priceValue > 0;

    return { net, profit, margin, hasInput, costValue, priceValue };
  }, [cost, price, discount]);

  const profitPositive = result.profit >= 0;

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5"
      aria-labelledby="price-calc-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--info-soft)] text-[var(--info-ink)]">
            <Calculator size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="price-calc-title"
              className="truncate text-[16px] font-bold tracking-tight text-[var(--ink)]"
            >
              คิดราคา / กำไร
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-tertiary)]">
              ราคาหลังหักส่วนลดและกำไรต่อชิ้น
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">ต้นทุน (บาท)</span>
          <input
            type="text"
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums text-[var(--ink)] placeholder:text-[var(--ink-divider)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">ราคาตั้งขาย</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums text-[var(--ink)] placeholder:text-[var(--ink-divider)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--ink-muted)]">ส่วนลด (%)</span>
          <input
            type="text"
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums text-[var(--ink)] placeholder:text-[var(--ink-divider)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-3 gap-2.5">
        <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--surface-grouped)] px-2 py-3 text-center">
          <span className="text-[11px] font-medium text-[var(--ink-muted)]">ราคาหลังหักส่วนลด</span>
          <span className="mt-1 tabular-nums text-[18px] font-extrabold leading-none text-[var(--ink)]">
            {money.format(result.net)}
          </span>
          <span className="mt-1 text-[10px] text-[var(--ink-tertiary)]">บาท</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--surface-grouped)] px-2 py-3 text-center">
          <span className="text-[11px] font-medium text-[var(--ink-muted)]">กำไรต่อชิ้น</span>
          <span
            className={`mt-1 tabular-nums text-[18px] font-extrabold leading-none ${
              result.hasInput
                ? profitPositive
                  ? 'text-[var(--success-ink)]'
                  : 'text-[var(--danger)]'
                : 'text-[var(--ink-divider)]'
            }`}
          >
            {money.format(result.profit)}
          </span>
          <span className="mt-1 text-[10px] text-[var(--ink-tertiary)]">บาท</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--surface-grouped)] px-2 py-3 text-center">
          <span className="text-[11px] font-medium text-[var(--ink-muted)]">กำไร (%)</span>
          <span
            className={`mt-1 tabular-nums text-[18px] font-extrabold leading-none ${
              result.hasInput
                ? profitPositive
                  ? 'text-[var(--success-ink)]'
                  : 'text-[var(--danger)]'
                : 'text-[var(--ink-divider)]'
            }`}
          >
            {result.hasInput ? `${result.margin.toFixed(1)}%` : '—'}
          </span>
          <span className="mt-1 text-[10px] text-[var(--ink-tertiary)]">คิดจากราคาขาย</span>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--hairline-soft)] pt-2 text-[10px] text-[var(--ink-secondary)]">
        {result.hasInput
          ? `ต้นทุน ${money.format(result.costValue)} · ราคาตั้ง ${money.format(result.priceValue)} บาท`
          : 'กรอกตัวเลขเพื่อเริ่มคำนวณ'}
      </div>
    </section>
  );
}
