import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import CurrencyConverterWidget from './CurrencyConverterWidget';

const SUMMARY = {
  currency: {
    rates: [
      { code: 'USD', name: 'ดอลลาร์สหรัฐ', unit: 1, thb: 34.5 },
      { code: 'JPY', name: 'เยนญี่ปุ่น', unit: 100, thb: 23.4 },
    ],
  },
};

/*
 * The widget keeps the daily rates in module scope, so the first test loads
 * them and the rest build on that copy — which is exactly how the dashboard
 * behaves when a widget remounts. The failure case therefore runs first, while
 * the cache is still empty.
 */
describe('CurrencyConverterWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers a retry when the rates cannot be loaded, then converts', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    render(<CurrencyConverterWidget />);

    const retry = await screen.findByRole('button', {
      name: /โหลดอัตราแลกเปลี่ยนไม่สำเร็จ/,
    });

    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: async () => SUMMARY });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText(/2\.90/)).toBeInTheDocument());
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it('converts the default 100 THB into USD', async () => {
    render(<CurrencyConverterWidget />);

    expect(await screen.findByText(/2\.90/)).toBeInTheDocument();
    expect(screen.getByText(/100\.00 THB =/)).toBeInTheDocument();
    // 1 USD = 34.50 THB, derived from the rate's own unit/thb pair.
    expect(screen.getByText(/1 USD ≈ 34\.50 THB/)).toBeInTheDocument();
  });

  it('swaps the two currencies', async () => {
    render(<CurrencyConverterWidget />);
    await screen.findByText(/2\.90/);

    fireEvent.click(screen.getByRole('button', { name: 'สลับสกุลเงิน' }));

    expect(await screen.findByText(/3,450\.00/)).toBeInTheDocument();
    expect(screen.getByText(/100\.00 USD =/)).toBeInTheDocument();
  });

  it('recomputes while the amount is edited', async () => {
    render(<CurrencyConverterWidget />);
    await screen.findByText(/2\.90/);

    fireEvent.change(screen.getByLabelText('จำนวนเงินที่ต้องการแปลง'), {
      target: { value: '1000' },
    });

    expect(await screen.findByText(/28\.99/)).toBeInTheDocument();
  });
});
