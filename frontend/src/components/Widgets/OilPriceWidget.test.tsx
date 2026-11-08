import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

vi.mock('@/components/Layout/NotificationBell', () => ({
  pushNotifications: vi.fn(),
}));

import OilPriceWidget from './OilPriceWidget';

const PRICES = {
  success: true,
  update_date: '2026-11-08',
  source: 'Bangchak',
  prices: [
    { key: 'gasohol_95', name: 'แก๊สโซฮอล์ 95', price: 36.5, unit: 'บาท/ลิตร', icon: 'fuel' },
    { key: 'diesel', name: 'ดีเซล', price: 32.94, unit: 'บาท/ลิตร', icon: 'fuel' },
  ],
};

describe('OilPriceWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // The widget logs upstream failures on purpose; the assertions below are
    // about the banner, so keep the suite's output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a labelled loading state before the first response', () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));

    render(<OilPriceWidget />);

    expect(screen.getByRole('status', { name: 'กำลังโหลดราคาน้ำมัน' })).toBeInTheDocument();
  });

  it('renders each price from the API', async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: async () => PRICES });

    render(<OilPriceWidget />);

    expect(await screen.findByText('แก๊ส 95')).toBeInTheDocument();
    expect(screen.getByText('ดีเซล')).toBeInTheDocument();
    expect(screen.getByText(/36\.50/)).toBeInTheDocument();
    expect(screen.getByText(/32\.94/)).toBeInTheDocument();
  });

  it('reports an unreadable payload instead of a blank card', async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, update_date: '', source: '' }),
    });

    render(<OilPriceWidget />);

    expect(await screen.findByText('ไม่สามารถดึงข้อมูลราคาน้ำมันได้')).toBeInTheDocument();
  });

  it('explains a gateway failure and still retries on demand', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({}),
    });

    render(<OilPriceWidget />);

    expect(
      await screen.findByText(/เชื่อมต่อแหล่งข้อมูลน้ำมันไม่สำเร็จ/),
    ).toBeInTheDocument();

    mockFetchWithAuth.mockResolvedValue({ ok: true, json: async () => PRICES });
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));

    expect(await screen.findByText('แก๊ส 95')).toBeInTheDocument();
  });
});
