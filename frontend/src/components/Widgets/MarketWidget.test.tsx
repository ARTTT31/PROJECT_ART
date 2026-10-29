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

  it('renders selectable TradingView candlestick charts for gold and currencies', async () => {
    api.fetchWithAuth.mockResolvedValue({ ok: true, json: async () => marketSummary });
    render(<MarketWidget />);

    await screen.findByRole('combobox', { name: 'เลือกสกุลเงิน' });
    await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]',
      );
      expect(script).toBeTruthy();
      expect(JSON.parse(script!.text).symbol).toBe('OANDA:XAUUSD');
      expect(JSON.parse(script!.text).style).toBe('1');
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกสินทรัพย์ในกราฟ' }), {
      target: { value: 'USD' },
    });

    await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]',
      );
      expect(script).toBeTruthy();
      expect(JSON.parse(script!.text).symbol).toBe('FX_IDC:USDTHB');
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกช่วงเวลาแท่งเทียน' }), {
      target: { value: '60' },
    });
    await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]',
      );
      expect(JSON.parse(script!.text).interval).toBe('60');
    });
  });
});
