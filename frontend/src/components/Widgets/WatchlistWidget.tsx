'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  clearPending,
  isOffline,
  readCached,
  readPending,
  writeCached,
  writePending,
} from '@/lib/offline/localStore';
import { useOnlineStatus } from '@/lib/offline/useOnlineStatus';

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
const WATCHLIST_OFFLINE_KEY = 'profile/watchlist';

interface WatchlistSnapshot {
  symbols: WatchlistSymbol[];
  quotes: Record<string, Quote>;
}
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
  // The mirror keeps the list (and its last quotes) readable without a network.
  const [initial] = useState(() => readCached<WatchlistSnapshot>(WATCHLIST_OFFLINE_KEY));
  const [symbols, setSymbols] = useState<WatchlistSymbol[]>(initial?.data.symbols ?? []);
  const [quotes, setQuotes] = useState<Record<string, Quote>>(initial?.data.quotes ?? {});
  const [loading, setLoading] = useState(initial === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(
    () => readPending(WATCHLIST_OFFLINE_KEY) !== null,
  );
  const [draft, setDraft] = useState('');
  const online = useOnlineStatus();
  // A slow PUT must not land after a newer one and resurrect a removed symbol.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);
  const symbolsRef = useRef<WatchlistSymbol[]>(initial?.data.symbols ?? []);
  const quotesRef = useRef<Record<string, Quote>>(initial?.data.quotes ?? {});

  const loadQuotes = useCallback(async (list: WatchlistSymbol[]) => {
    if (list.length === 0) {
      setQuotes({});
      quotesRef.current = {};
      writeCached(WATCHLIST_OFFLINE_KEY, { symbols: list, quotes: {} });
      return;
    }
    // Cached prices stay on screen offline; there is nothing to fetch.
    if (isOffline()) return;
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
      quotesRef.current = map;
      writeCached(WATCHLIST_OFFLINE_KEY, { symbols: list, quotes: map });
      setError(null);
    } catch {
      // Stale prices are better than an empty card; only a missing mirror is
      // worth an alert.
      if (!readCached(WATCHLIST_OFFLINE_KEY)) setError('ดึงราคาล่าสุดไม่สำเร็จ');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (isOffline()) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/v1/profile/watchlist');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { symbols?: WatchlistSymbol[] };
      const list = Array.isArray(data.symbols) ? data.symbols : [];
      // An offline edit has not reached the server yet; replacing the list with
      // the older server copy would drop it before the flush.
      if (readPending(WATCHLIST_OFFLINE_KEY)) {
        setPendingSync(true);
        return;
      }
      setSymbols(list);
      symbolsRef.current = list;
      writeCached(WATCHLIST_OFFLINE_KEY, { symbols: list, quotes: quotesRef.current });
      await loadQuotes(list);
    } catch {
      if (!readCached(WATCHLIST_OFFLINE_KEY)) setError('โหลดรายการติดตามไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [loadQuotes]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback((next: WatchlistSymbol[]) => {
    const sequence = ++saveSequenceRef.current;
    // Keep the list locally first; offline it is the only copy until reconnect.
    writeCached(WATCHLIST_OFFLINE_KEY, { symbols: next, quotes: quotesRef.current });
    writePending(WATCHLIST_OFFLINE_KEY, { symbols: next });
    setPendingSync(true);

    const save = async () => {
      try {
        if (isOffline()) return;
        const res = await fetchWithAuth('/api/v1/profile/watchlist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (sequence === saveSequenceRef.current) {
          clearPending(WATCHLIST_OFFLINE_KEY);
          setPendingSync(false);
          setError(null);
        }
      } catch {
        if (sequence === saveSequenceRef.current) {
          setError('บันทึกในเครื่องแล้ว ระบบจะซิงก์ให้เมื่อกลับมาออนไลน์');
        }
      }
    };

    const queued = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  // Replay a list change queued while offline (here or in a previous session)
  // once the connection is back, then refresh the prices it needs.
  useEffect(() => {
    const flush = () => {
      if (!readPending(WATCHLIST_OFFLINE_KEY)) return;
      void persist(symbolsRef.current);
      void loadQuotes(symbolsRef.current);
    };
    if (!isOffline()) flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [persist, loadQuotes]);

  const addSymbol = (customSymbol?: string) => {
    const symbol = (customSymbol ?? draft).trim().toUpperCase();
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
    symbolsRef.current = next;
    void persist(next);
    void loadQuotes(next);
  };

  const removeSymbol = (symbol: string) => {
    const next = symbols.filter((item) => item.symbol !== symbol);
    setSymbols(next);
    symbolsRef.current = next;
    void persist(next);
  };

  const up = useMemo(
    () => symbols.filter((item) => (quotes[item.symbol]?.change ?? 0) >= 0).length,
    [symbols, quotes],
  );

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[300px] items-center justify-center rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5"
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
      className="flex h-full flex-col rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5"
      aria-labelledby="watchlist-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--info-soft)] text-[var(--info-ink)]">
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
          className="min-w-0 flex-1 rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] uppercase text-[var(--ink)] placeholder:normal-case placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
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
        <p role="alert" className="mt-2.5 rounded-apple-md bg-[var(--danger-soft)] px-3 py-1.5 text-[12px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}

      <ul
        className="mt-3 max-h-[248px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการติดตาม"
      >
        {symbols.length === 0 ? (
          <li className="flex min-h-[110px] flex-col items-center justify-center rounded-apple-widget border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-3.5 py-5 text-center text-[13px] text-[var(--ink-tertiary)]">
            <TrendingUp size={20} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>ยังไม่มีรายการติดตาม</span>
            <span className="mt-0.5 text-[11px]">ลองพิมพ์ PTT.BK, AAPL หรือ BTC-USD</span>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              {['SET50', 'PTT.BK', 'BTC-USD', 'AAPL'].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => addSymbol(quick)}
                  className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--hairline)] hover:bg-[var(--accent)]/10 transition-colors active:scale-[0.95]"
                >
                  +{quick}
                </button>
              ))}
            </div>
          </li>
        ) : (
          symbols.map((item) => {
            const quote = quotes[item.symbol];
            const change = quote?.change ?? null;
            const isUp = (change ?? 0) >= 0;
            return (
              <li
                key={item.symbol}
                className="group flex items-center gap-2.5 rounded-apple-widget bg-[var(--surface-grouped)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
                    {item.symbol}
                  </span>
                  {quote?.name && (
                    <span className="block truncate text-[11px] text-[var(--ink-tertiary)]">{quote.name}</span>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span className="block tabular-nums text-[13px] font-bold text-[var(--ink)]">
                    {quote?.price != null ? priceFormat.format(quote.price) : '—'}
                  </span>
                  {change != null && (
                    <span
                      className={`block tabular-nums text-[11px] font-semibold ${
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

      <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline-soft)] pt-2 text-[11px] text-[var(--ink-secondary)]">
        <span>ราคาจาก Yahoo Finance · อาจล่าช้า</span>
        <span className="inline-flex items-center gap-1">
          {refreshing && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
          {pendingSync
            ? online
              ? 'รอซิงก์'
              : 'บันทึกในเครื่องแล้ว'
            : `${symbols.length}/${MAX_SYMBOLS}`}
        </span>
      </div>
    </section>
  );
}
