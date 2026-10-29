'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

type EntryType = 'income' | 'expense';

interface FinanceEntry {
  id: string;
  type: EntryType;
  label: string;
  amount: number;
  date: string;
}

const MAX_ENTRIES = 200;
const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Income / expense tracker for today, stored per account on the server. */
export default function FinanceWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<EntryType>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/v1/profile/finance');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { entries?: FinanceEntry[] };
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [load]);

  const persist = useCallback(async (next: FinanceEntry[]) => {
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/profile/finance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setError(null);
    } catch {
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  }, []);

  const update = (next: FinanceEntry[]) => {
    setEntries(next);
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => void persist(next), 400);
  };

  const addEntry = () => {
    const value = Number.parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('กรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    if (entries.length >= MAX_ENTRIES) {
      setError(`เก็บได้สูงสุด ${MAX_ENTRIES} รายการ`);
      return;
    }
    setError(null);
    setAmount('');
    setLabel('');
    update([
      {
        id: newId(),
        type,
        label: label.trim().slice(0, 60),
        amount: Math.round(value * 100) / 100,
        date: today(),
      },
      ...entries,
    ]);
  };

  const removeEntry = (id: string) => update(entries.filter((entry) => entry.id !== id));

  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.date === today()),
    [entries],
  );
  const income = todayEntries
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = todayEntries
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const balance = income - expense;

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[300px] items-center justify-center rounded-[18px] border border-black/[0.06] bg-white p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดรายรับรายจ่าย"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#0066cc]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="finance-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#34c759]/10 text-[#248a3d]">
            <Wallet size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="finance-title" className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]">
              รายรับ – รายจ่ายวันนี้
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {todayEntries.length > 0 ? `${todayEntries.length} รายการวันนี้` : 'บันทึกรายการแรกของวัน'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-[14px] bg-[#34c759]/10 px-3 py-2.5">
          <span className="block text-[11px] font-semibold text-[#248a3d]">รายรับ</span>
          <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[#1d1d1f]">
            {money.format(income)}
          </span>
        </div>
        <div className="rounded-[14px] bg-[#ff3b30]/10 px-3 py-2.5">
          <span className="block text-[11px] font-semibold text-[#b42318]">รายจ่าย</span>
          <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[#1d1d1f]">
            {money.format(expense)}
          </span>
        </div>
        <div className="rounded-[14px] bg-[#f5f5f7] px-3 py-2.5">
          <span className="block text-[11px] font-semibold text-[#6e6e73]">คงเหลือ</span>
          <span
            className={`mt-0.5 block tabular-nums text-[15px] font-extrabold ${
              balance < 0 ? 'text-[#b42318]' : 'text-[#1d1d1f]'
            }`}
          >
            {money.format(balance)}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 rounded-[10px] bg-[#ff3b30]/[0.07] px-3 py-1.5 text-[12px] text-[#b42318]">
          {error}
        </p>
      )}

      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          addEntry();
        }}
      >
        <div className="flex gap-2">
          <div className="inline-flex rounded-full bg-[#e5e5ea] p-0.5" role="group" aria-label="ประเภทรายการ">
            {(['expense', 'income'] as EntryType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                aria-pressed={type === option}
                className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
                  type === option ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73]'
                }`}
              >
                {option === 'expense' ? 'รายจ่าย' : 'รายรับ'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="รายการ เช่น ค่ากาแฟ"
            aria-label="ชื่อรายการ"
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[12.5px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="จำนวนเงิน"
            aria-label="จำนวนเงิน"
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] tabular-nums text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
          />
          <button
            type="submit"
            aria-label="เพิ่มรายการ"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-white transition-all hover:bg-[#0071e3] active:scale-95 disabled:opacity-40"
            disabled={!amount.trim()}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </form>

      <ul
        className="mt-3 max-h-[248px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการวันนี้"
      >
        {todayEntries.length === 0 ? (
          <li className="flex min-h-[92px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-3 py-4 text-center text-[12.5px] text-[#86868b]">
            <Wallet size={18} className="mb-1.5 text-[#a1a1a6]" aria-hidden="true" />
            ยังไม่มีรายการวันนี้
          </li>
        ) : (
          todayEntries.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-center gap-2.5 rounded-[12px] bg-[#f5f5f7] px-3 py-2"
            >
              {entry.type === 'income' ? (
                <ArrowUpCircle size={16} className="shrink-0 text-[#248a3d]" aria-hidden="true" />
              ) : (
                <ArrowDownCircle size={16} className="shrink-0 text-[#b42318]" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#1d1d1f]">
                {entry.label || (entry.type === 'income' ? 'รายรับ' : 'รายจ่าย')}
              </span>
              <span
                className={`shrink-0 tabular-nums text-[12.5px] font-bold ${
                  entry.type === 'income' ? 'text-[#248a3d]' : 'text-[#1d1d1f]'
                }`}
              >
                {entry.type === 'income' ? '+' : '−'}
                {money.format(entry.amount)}
              </span>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label={`ลบ ${entry.label || 'รายการ'}`}
                className="shrink-0 rounded-full p-1 text-[#86868b] opacity-100 transition-colors hover:bg-white hover:text-[#ff3b30] md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2 text-[10px] text-[#475569]">
        <span>บันทึกอัตโนมัติ</span>
        <span className="inline-flex items-center gap-1">
          {saving && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
          {saving ? 'กำลังบันทึก...' : `${entries.length}/${MAX_ENTRIES}`}
        </span>
      </div>
    </section>
  );
}
