'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import FinanceSummaryDialog from './FinanceSummaryDialog';
import FinanceEntryDialog, { type FinanceEntryValues } from './FinanceEntryDialog';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  FINANCE_CATEGORIES,
  MAX_FINANCE_ENTRIES,
  MAX_FINANCE_LABEL,
  type EntryType,
  type FinanceEntry,
  monthKeyOf,
  parseAmountInput,
  summarize,
  todayKey,
} from '@/lib/finance/summary';

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Income / expense tracker for today, stored per account on the server.
 *
 * Writes are whole-list PUTs, so a save first reads the server copy and merges
 * in entries added by another tab or device instead of silently dropping them.
 * Deletions made here are remembered (``deletedRef``) so that merge does not
 * resurrect them.
 */
export default function FinanceWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<EntryType>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey);
  const [category, setCategory] = useState('');
  const [today, setToday] = useState(todayKey);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [undo, setUndo] = useState<FinanceEntry | null>(null);

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<FinanceEntry[]>([]);
  const latestBudgetRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const deletedRef = useRef<Set<string>>(new Set());
  const retryPendingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/v1/profile/finance');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { entries?: FinanceEntry[]; budget?: number | null };
      const loaded = Array.isArray(data.entries) ? data.entries : [];
      const loadedBudget = typeof data.budget === 'number' ? data.budget : null;
      latestRef.current = loaded;
      latestBudgetRef.current = loadedBudget;
      setEntries(loaded);
      setBudget(loadedBudget);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add entries another tab/device saved since this one loaded.
   *
   * The endpoint replaces the whole list, so without this a save from here
   * would erase whatever the other client added in the meantime.
   */
  const mergeWithServer = useCallback(async (local: FinanceEntry[]): Promise<FinanceEntry[]> => {
    try {
      const res = await fetchWithAuth('/api/v1/profile/finance');
      if (!res.ok) return local;
      const data = (await res.json()) as { entries?: FinanceEntry[] };
      const serverEntries = Array.isArray(data.entries) ? data.entries : [];
      const localIds = new Set(local.map((entry) => entry.id));
      const remoteOnly = serverEntries.filter(
        (entry) => !localIds.has(entry.id) && !deletedRef.current.has(entry.id),
      );
      if (remoteOnly.length === 0) return local;

      const merged = [...local, ...remoteOnly].slice(0, MAX_FINANCE_ENTRIES);
      latestRef.current = merged;
      if (mountedRef.current) setEntries(merged);
      return merged;
    } catch {
      return local;
    }
  }, []);

  const persist = useCallback(
    (next: FinanceEntry[], nextBudget: number | null) => {
      const sequence = ++saveSequenceRef.current;
      if (mountedRef.current) setSaving(true);

      // Queue writes so a slower earlier request cannot overwrite a newer list,
      // and so the payload order matches the order the user made the edits.
      const save = async () => {
        try {
          const merged = await mergeWithServer(next);
          const res = await fetchWithAuth('/api/v1/profile/finance', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: merged, budget: nextBudget }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          retryPendingRef.current = false;
          // Everything local (including this session's deletions) is now the
          // server copy, so tombstones are no longer needed.
          deletedRef.current.clear();
          if (sequence === saveSequenceRef.current && mountedRef.current) {
            setError(null);
            setSaving(false);
          }
        } catch {
          retryPendingRef.current = true;
          if (sequence === saveSequenceRef.current && mountedRef.current) {
            setError('บันทึกไม่สำเร็จ ระบบจะลองใหม่ให้อัตโนมัติ');
            setSaving(false);
          }
        }
      };

      const queued = saveQueueRef.current.then(save, save);
      saveQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [mergeWithServer],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      // Leaving the dashboard must not drop an edit made inside the debounce
      // window. Flush only when a save is still pending; a fired timer is
      // cleared when it runs, so this cannot double-save.
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
        void persist(latestRef.current, latestBudgetRef.current);
      }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [load, persist]);

  // A failed save keeps a retry pending instead of losing the edit: retry when
  // the connection comes back, and on a slow interval as a fallback.
  useEffect(() => {
    const retry = () => {
      if (!retryPendingRef.current) return;
      retryPendingRef.current = false;
      void persist(latestRef.current, latestBudgetRef.current);
    };
    const interval = setInterval(retry, 15_000);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', retry);
    };
  }, [persist]);

  // "Today" has to move on its own: an always-on dashboard used to keep showing
  // yesterday's rows under the "วันนี้" heading until the next edit.
  useEffect(() => {
    const tick = () => setToday(todayKey());
    const interval = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const scheduleSave = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      void persist(latestRef.current, latestBudgetRef.current);
    }, 400);
  }, [persist]);

  const update = (next: FinanceEntry[]) => {
    latestRef.current = next;
    setEntries(next);
    scheduleSave();
  };

  const saveBudget = (value: number | null) => {
    latestBudgetRef.current = value;
    setBudget(value);
    scheduleSave();
  };

  const addEntry = () => {
    const value = parseAmountInput(amount);
    if (value === null) {
      setError('กรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    if (latestRef.current.length >= MAX_FINANCE_ENTRIES) {
      setError(`เก็บได้สูงสุด ${money.format(MAX_FINANCE_ENTRIES)} รายการ`);
      return;
    }
    setError(null);
    setAmount('');
    setLabel('');
    setCategory('');
    setDate(todayKey());
    update([
      {
        id: newId(),
        type,
        label: label.trim().slice(0, MAX_FINANCE_LABEL),
        amount: value,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey(),
        ...(category.trim() ? { category: category.trim().slice(0, 40) } : {}),
      },
      ...latestRef.current,
    ]);
  };

  const applyEdit = (values: FinanceEntryValues) => {
    if (!editing) return;
    update(
      latestRef.current.map((entry) =>
        entry.id === editing.id
          ? {
              ...entry,
              type: values.type,
              label: values.label,
              amount: values.amount,
              date: values.date,
              ...(values.category ? { category: values.category } : { category: undefined }),
            }
          : entry,
      ),
    );
    setEditing(null);
  };

  const removeEntry = (entry: FinanceEntry) => {
    deletedRef.current.add(entry.id);
    update(latestRef.current.filter((item) => item.id !== entry.id));
    setUndo(entry);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setUndo(null);
    }, 8000);
  };

  const undoDelete = () => {
    if (!undo) return;
    deletedRef.current.delete(undo.id);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    update([undo, ...latestRef.current]);
    setUndo(null);
  };

  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.date === today),
    [entries, today],
  );
  const income = todayEntries
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = todayEntries
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const balance = income - expense;

  const monthExpense = useMemo(() => {
    const month = monthKeyOf(today);
    return summarize(
      entries.filter((entry) => entry.type === 'expense' && monthKeyOf(entry.date) === month),
    ).expense;
  }, [entries, today]);
  const budgetUsed = budget && budget > 0 ? Math.min(100, (monthExpense / budget) * 100) : 0;
  const overBudget = budget !== null && monthExpense > budget;

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
            <h3
              id="finance-title"
              className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]"
            >
              รายรับ – รายจ่ายวันนี้
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {todayEntries.length > 0
                ? `${todayEntries.length} รายการวันนี้`
                : 'บันทึกรายการแรกของวัน'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSummaryOpen(true)}
            aria-label="ดูภาพรวมรายรับรายจ่าย"
            title="ดูภาพรวมทุกเดือน"
            className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#6e6e73] transition-colors hover:bg-[#e5e5ea] hover:text-[#1d1d1f] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]"
          >
            <BarChart3 size={13} aria-hidden="true" />
            <span className="hidden sm:inline">ภาพรวม</span>
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
        </div>
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

      {budget !== null && (
        <div className="mt-2.5 rounded-[12px] bg-[#f8f8fa] px-3 py-2">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-semibold text-[#6e6e73]">งบเดือนนี้</span>
            <span
              className={`tabular-nums font-bold ${overBudget ? 'text-[#b42318]' : 'text-[#1d1d1f]'}`}
            >
              {money.format(monthExpense)} / {money.format(budget)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e5ea]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overBudget ? 'bg-[#ff3b30]' : budgetUsed > 80 ? 'bg-[#ff9500]' : 'bg-[#34c759]'
              }`}
              style={{ width: `${Math.max(2, budgetUsed)}%` }}
            />
          </div>
          {overBudget && (
            <p className="mt-1 text-[10.5px] font-semibold text-[#b42318]">
              เกินงบไป {money.format(monthExpense - budget)} แล้ว
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2.5 rounded-[10px] bg-[#ff3b30]/[0.07] px-3 py-1.5 text-[12px] text-[#b42318]"
        >
          {error}
        </p>
      )}

      {undo && (
        <div
          role="status"
          className="mt-2.5 flex items-center justify-between gap-2 rounded-[10px] bg-[#1d1d1f] px-3 py-1.5 text-[11.5px] text-white"
        >
          <span className="min-w-0 truncate">
            ลบ “{undo.label || (undo.type === 'income' ? 'รายรับ' : 'รายจ่าย')}” แล้ว
          </span>
          <button
            type="button"
            onClick={undoDelete}
            className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-white/30"
          >
            เลิกทำ
          </button>
        </div>
      )}

      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          addEntry();
        }}
      >
        <div className="flex gap-2">
          <div
            className="inline-flex rounded-full bg-[#e5e5ea] p-0.5"
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
            maxLength={MAX_FINANCE_LABEL}
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
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="วันที่"
            className="w-[136px] shrink-0 rounded-xl border border-black/10 bg-white px-2 py-2 text-[12px] text-[#1d1d1f] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
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

        <input
          type="text"
          list="finance-categories"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="หมวดหมู่ (ไม่บังคับ)"
          aria-label="หมวดหมู่"
          maxLength={40}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
        />
        <datalist id="finance-categories">
          {FINANCE_CATEGORIES.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-[#1d1d1f]">
                  {entry.label || (entry.type === 'income' ? 'รายรับ' : 'รายจ่าย')}
                </span>
                {entry.category && (
                  <span className="block truncate text-[10.5px] text-[#86868b]">
                    {entry.category}
                  </span>
                )}
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
                onClick={() => setEditing(entry)}
                aria-label={`แก้ไข ${entry.label || 'รายการ'}`}
                className="shrink-0 rounded-full p-1 text-[#86868b] transition-colors hover:bg-white hover:text-[#0066cc] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => removeEntry(entry)}
                aria-label={`ลบ ${entry.label || 'รายการ'}`}
                className="shrink-0 rounded-full p-1 text-[#86868b] opacity-100 transition-colors hover:bg-white hover:text-[#ff3b30] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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
          {saving
            ? 'กำลังบันทึก...'
            : `${money.format(entries.length)}/${money.format(MAX_FINANCE_ENTRIES)}`}
        </span>
      </div>

      <FinanceSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        entries={entries}
        budget={budget}
        onBudgetChange={saveBudget}
      />
      <FinanceEntryDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        entry={editing}
        onSubmit={applyEdit}
      />
    </section>
  );
}
