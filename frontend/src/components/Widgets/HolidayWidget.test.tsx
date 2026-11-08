import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import HolidayWidget from './HolidayWidget';

const YEAR = new Date().getFullYear();

describe('HolidayWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchWithAuth.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  });

  it('renders the bundled public calendar without a company calendar', async () => {
    render(<HolidayWidget />);

    expect(screen.getByRole('heading', { name: 'วันหยุดนักขัตฤกษ์' })).toBeInTheDocument();
    expect(screen.getByText('วันหยุดถัดไป')).toBeInTheDocument();
    expect(screen.getByText('ปฏิทินวันหยุดราชการและประเพณี')).toBeInTheDocument();
    // The two filters report how many days each view holds.
    expect(screen.getByRole('button', { name: /ถัดไป \(\d+\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ทั้งหมด \(\d+\)/ })).toBeInTheDocument();
  });

  it('switches the filter without losing the list', async () => {
    render(<HolidayWidget />);

    const all = screen.getByRole('button', { name: /ทั้งหมด \(\d+\)/ });
    expect(all).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(all);

    await waitFor(() => expect(all).toHaveAttribute('aria-pressed', 'true'));
  });

  it('prefers the company calendar and labels it', async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        years: { [String(YEAR)]: [{ date: `${YEAR}-12-30`, title: 'หยุดบริษัทประจำปี' }] },
      }),
    });

    render(<HolidayWidget />);

    expect(await screen.findByText('ปฏิทินบริษัท')).toBeInTheDocument();
    expect(await screen.findByText('หยุดบริษัทประจำปี')).toBeInTheDocument();
  });

  it('keeps rendering when the company calendar request fails', async () => {
    mockFetchWithAuth.mockRejectedValue(new Error('offline'));

    render(<HolidayWidget />);

    expect(await screen.findByText('วันหยุดถัดไป')).toBeInTheDocument();
  });
});
