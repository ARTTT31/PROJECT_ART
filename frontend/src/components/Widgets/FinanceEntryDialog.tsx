'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  FINANCE_CATEGORIES,
  type EntryType,
  type FinanceEntry,
  MAX_FINANCE_LABEL,
  parseAmountInput,
} from '@/lib/finance/summary';

export interface FinanceEntryValues {
  type: EntryType;
  label: string;
  amount: number;
  date: string;
  category: string;
}

/**
 * Edit dialog for one finance entry.
 *
 * The inline add form can only ever create "today" rows, so this is also how a
 * forgotten expense gets its real date: the date field is editable here and
 * nowhere else.
 */
export default function FinanceEntryDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinanceEntry | null;
  onSubmit: (values: FinanceEntryValues) => void;
}) {
  const [type, setType] = useState<EntryType>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load the entry being edited each time the dialog opens, so a cancelled edit
  // never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setType(entry?.type ?? 'expense');
    setLabel(entry?.label ?? '');
    setAmount(entry ? String(entry.amount) : '');
    setDate(entry?.date ?? '');
    setCategory(entry?.category ?? '');
    setError(null);
  }, [open, entry]);

  const submit = () => {
    const value = parseAmountInput(amount);
    if (value === null) {
      setError('กรอกจำนวนเงินให้ถูกต้อง (มากกว่า 0 และไม่เกิน 1,000,000,000)');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('เลือกวันที่ให้ถูกต้อง');
      return;
    }
    onSubmit({
      type,
      label: label.trim().slice(0, MAX_FINANCE_LABEL),
      amount: value,
      date,
      category: category.trim().slice(0, 40),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] text-[var(--ink)]">แก้ไขรายการ</DialogTitle>
          <DialogDescription className="text-[12px] text-[var(--ink-tertiary)]">
            แก้ชื่อ จำนวนเงิน หมวด หรือเลื่อนวันที่ของรายการนี้
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div
            className="inline-flex rounded-full bg-[var(--surface-chip)] p-0.5"
            role="group"
            aria-label="ประเภทรายการ"
          >
            {(['expense', 'income'] as EntryType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                aria-pressed={type === option}
                className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
                  type === option ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--ink-muted)]'
                }`}
              >
                {option === 'expense' ? 'รายจ่าย' : 'รายรับ'}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--ink-muted)]">รายการ</span>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="เช่น ค่ากาแฟ"
              maxLength={MAX_FINANCE_LABEL}
              className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--ink-muted)]">
                จำนวนเงิน
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--ink-muted)]">วันที่</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--ink-muted)]">หมวดหมู่</span>
            <input
              type="text"
              list="finance-categories-edit"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="เช่น อาหาร"
              maxLength={40}
              className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
            <datalist id="finance-categories-edit">
              {FINANCE_CATEGORIES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-[var(--danger-soft)] px-3 py-1.5 text-[12px] text-[var(--danger-ink)]"
            >
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-[var(--surface-grouped)] px-5 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.97]"
          >
            บันทึกการแก้ไข
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
