import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketWidget from './MarketWidget';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));

const marketSummary = {
  currency: {
    id: 'frankfurter',
    source: 'Frankfurter · blended central-bank rates',
    updated_at: '2026-10-28',
    rates: [{ code: 'USD', name: 'ดอลลาร์สหรัฐ', unit: 1, thb: 33.77 }],
  },
  currency_sources: [
    {
      id: 'frankfurter',
      source: 'Frankfurter · blended central-bank rates',
      updated_at: '2026-10-28',
      rates: [{ code: 'USD', name: 'ดอลลาร์สหรัฐ', unit: 1, thb: 33.77 }],
    },
    {
      id: 'ecb',
      source: 'Frankfurter · ECB',
      updated_at: '2026-10-28',
      rates: [{ code: 'USD', name: 'ดอลลาร์สหรัฐ', unit: 1, thb: 34.01 }],
    },
  ],
  gold: {
    id: 'thai_gold',
    source: 'สมาคมค้าทองคำ · ทองคำแท่ง 96.5%',
    market: 'ทองคำแท่งไทย 96.5% · บาททองคำ',
    updated_at: '2026-10-28T08:00:00Z',
    buy: 64600,
    sell: 64800,
  },
  gold_sources: [
    {
      id: 'thai_gold',
      source: 'สมาคมค้าทองคำ · ทองคำแท่ง 96.5%',
      market: 'ทองคำแท่งไทย 96.5% · บาททองคำ',
      updated_at: '2026-10-28T08:00:00Z',
      buy: 64600,
      sell: 64800,
    },
    {
      id: 'comex_gold',
      source: 'Yahoo Finance · COMEX Gold Futures (GC=F)',
      market: 'COMEX Gold Futures · USD/oz · อาจมีความล่าช้า',
      updated_at: '2026-10-28T08:00:00Z',
      value: 4062.3,
      change: 54.4,
      change_percent: 1.36,
      currency: 'USD',
    },
  ],
  set_index: {
    source: 'SET (Yahoo Finance)',
    updated_at: '2026-10-28T08:00:00Z',
    value: 1568.19,
    change: -6.83,
    change_percent: -0.43,
  },
  fetched_at: '2026-10-28T08:00:00Z',
  is_stale: false,
};

describe('MarketWidget', () => {
  it('allows choosing a daily rate source and gold market', async () => {
    api.fetchWithAuth.mockResolvedValue({ ok: true, json: async () => marketSummary });
    render(<MarketWidget />);

    await screen.findByRole('combobox', { name: 'เลือกสกุลเงิน' });
    expect(screen.getByRole('option', { name: 'Frankfurter · ECB' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'COMEX Gold Futures (USD/oz)' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกแหล่งข้อมูลค่าเงิน' }), {
      target: { value: 'ecb' },
    });
    expect(screen.getByText('34.01')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกแหล่งราคาทอง' }), {
      target: { value: 'comex_gold' },
    });
    expect(screen.getByText('4,062.30')).toBeTruthy();
    expect(screen.getByText(/COMEX Gold Futures · USD\/oz/)).toBeTruthy();
  });

  it('draws its own candlestick chart from the proxied OHLC bars', async () => {
    // The TradingView embed this used to load is blocked on several Thai
    // networks, so the chart is now drawn from `/market/candles`.
    api.fetchWithAuth.mockImplementation(async (url: string) => {
      if (url.includes('/market/candles')) {
        return {
          ok: true,
          json: async () => ({
            symbol: 'gold',
            label: 'ทองคำ COMEX · USD/oz',
            interval: '1d',
            source: 'Yahoo Finance',
            updated_at: '2026-10-28T00:00:00+07:00',
            points: [
              { t: '2026-10-26T00:00:00+07:00', o: 4000, h: 4050, l: 3980, c: 4040 },
              { t: '2026-10-27T00:00:00+07:00', o: 4040, h: 4090, l: 4020, c: 4025 },
            ],
          }),
        };
      }
      return { ok: true, json: async () => marketSummary };
    });

    render(<MarketWidget />);
    await screen.findByRole('combobox', { name: 'เลือกสกุลเงิน' });

    const chart = await screen.findByRole('img', { name: /กราฟแท่งเทียน/ });
    expect(chart.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(api.fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/market/candles?symbol=gold&interval=1d'),
      expect.anything(),
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกสินทรัพย์ในกราฟ' }), {
      target: { value: 'USD' },
    });
    await waitFor(() => {
      expect(api.fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('symbol=USD'),
        expect.anything(),
      );
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกช่วงเวลาแท่งเทียน' }), {
      target: { value: '60m' },
    });
    await waitFor(() => {
      expect(api.fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('interval=60m'),
        expect.anything(),
      );
    });
  });
});
