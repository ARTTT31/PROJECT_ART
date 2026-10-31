'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface WatchlistSymbol {
  symbol: string;
  label?: string | null;
}

interface Quote {
  symbol: string;
  price?: number | null;
  change?: number | null;
  change_percent?: number | null;
  currency?: string | null;
  name?: string | null;
}

const MAX_SYMBOLS = 12;
const SYMBOL_PATTERN = /^[A-Z0-9.^=-]{1,24}$/;
const priceFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 4 });

/**
 * Followed symbols (stocks / crypto / FX) with the latest quote.
 *
 * The list is stored per account; the quotes come from the market endpoint so
 * the browser never talks to Yahoo Finance directly (CSP + rate limits).
 */
export default function WatchlistWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [symbols, setSymbols] = useState<WatchlistSymbol[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // A slow PUT must not land after a newer one and resurrect a removed symbol.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const loadQuotes = useCallback(async (list: WatchlistSymbol[]) => {
    if (list.length === 0) {
      setQuotes({});
      return;
    }
    setRefreshing(true);
    try {
      const codes = list.map((item) => item.symbol).join(',');
      const res = await fetchWithAuth(`/api/v1/market/quotes?symbols=${encodeURIComponent(codes)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Quote[];
      const map: Record<string, Quote> = {};
      data.forEach((quote) => {
        map[quote.symbol] = quote;
      });
      setQuotes(map);
      setError(null);
    } catch {
      setError('ดึงราคาล่าสุดไม่สำเร็จ');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/profile/watchlist');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { symbols?: WatchlistSymbol[] };
      const list = Array.isArray(data.symbols) ? data.symbols : [];
      setSymbols(list);
      await loadQuotes(list);
    } catch {
      setError('โหลดรายการติดตามไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [loadQuotes]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback((next: WatchlistSymbol[]) => {
    const save = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/profile/watchlist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setError(null);
      } catch {
        setError('บันทึกรายการติดตามไม่สำเร็จ');
      }
    };

    const queued = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  const addSymbol = () => {
    const symbol = draft.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      setError('ชื่อย่อต้องเป็นตัวอักษรหรือตัวเลข เช่น PTT.BK หรือ BTC-USD');
      return;
    }
    if (symbols.some((item) => item.symbol === symbol)) {
      setError('มีรายการนี้อยู่แล้ว');
      return;
    }
    if (symbols.length >= MAX_SYMBOLS) {
      setError(`ติดตามได้สูงสุด ${MAX_SYMBOLS} รายการ`);
      return;
    }
    const next = [...symbols, { symbol }];
    setDraft('');
    setError(null);
    setSymbols(next);
    void persist(next);
    void loadQuotes(next);
  };

  const removeSymbol = (symbol: string) => {
    const next = symbols.filter((item) => item.symbol !== symbol);
    setSymbols(next);
    void persist(next);
  };

  const up = useMemo(
    () => symbols.filter((item) => (quotes[item.symbol]?.change ?? 0) >= 0).length,
    [symbols, quotes],
  );

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[300px] items-center justify-center rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดรายการติดตาม"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="watchlist-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--info-soft)] text-[var(--info-ink)]">
            <TrendingUp size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="watchlist-title" className="truncate text-[16px] font-bold tracking-tight text-[var(--ink)]">
              รายการติดตาม
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-tertiary)]">
              {symbols.length > 0
                ? `${symbols.length} สัญลักษณ์ · เพิ่มขึ้น ${up}`
                : 'ติดตามหุ้น คริปโต หรือค่าเงินที่สนใจ'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addSymbol();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          placeholder="เพิ่มสัญลักษณ์ เช่น PTT.BK"
          aria-label="เพิ่มสัญลักษณ์ในรายการติดตาม"
          maxLength={24}
          className="min-w-0 flex-1 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] uppercase text-[var(--ink)] placeholder:normal-case placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="เพิ่มสัญลักษณ์"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void loadQuotes(symbols)}
          aria-label="รีเฟรชราคา"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-grouped-2)] text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)]"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2.5 rounded-[10px] bg-[var(--danger-soft)] px-3 py-1.5 text-[12px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}

      <ul
        className="mt-3 max-h-[248px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการติดตาม"
      >
        {symbols.length === 0 ? (
          <li className="flex min-h-[110px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-3.5 py-5 text-center text-[12.5px] text-[var(--ink-tertiary)]">
            <TrendingUp size={20} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>ยังไม่มีรายการติดตาม</span>
            <span className="mt-0.5 text-[11px]">ลองพิมพ์ PTT.BK, AAPL หรือ BTC-USD</span>
          </li>
        ) : (
          symbols.map((item) => {
            const quote = quotes[item.symbol];
            const change = quote?.change ?? null;
            const isUp = (change ?? 0) >= 0;
            return (
              <li
                key={item.symbol}
                className="group flex items-center gap-2.5 rounded-[12px] bg-[var(--surface-grouped)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">
                    {item.symbol}
                  </span>
                  {quote?.name && (
                    <span className="block truncate text-[10.5px] text-[var(--ink-tertiary)]">{quote.name}</span>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span className="block tabular-nums text-[12.5px] font-bold text-[var(--ink)]">
                    {quote?.price != null ? priceFormat.format(quote.price) : '—'}
                  </span>
                  {change != null && (
                    <span
                      className={`block tabular-nums text-[10.5px] font-semibold ${
                        isUp ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'
                      }`}
                    >
                      {isUp ? '+' : ''}
                      {quote?.change_percent?.toFixed(2)}%
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeSymbol(item.symbol)}
                  aria-label={`เลิกติดตาม ${item.symbol}`}
                  className="shrink-0 rounded-full p-1 text-[var(--ink-tertiary)] opacity-100 transition-colors hover:bg-[var(--surface)] hover:text-[var(--danger)] md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline-soft)] pt-2 text-[10px] text-[var(--ink-secondary)]">
        <span>ราคาจาก Yahoo Finance · อาจล่าช้า</span>
        <span className="inline-flex items-center gap-1">
          {refreshing && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
          {symbols.length}/{MAX_SYMBOLS}
        </span>
      </div>
    </section>
  );
}
