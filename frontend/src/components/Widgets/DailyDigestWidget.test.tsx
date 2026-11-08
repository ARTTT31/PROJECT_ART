import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DailyDigestWidget from './DailyDigestWidget';

// Mock fetchWithAuth
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn().mockImplementation((url: string) => {
    if (url.includes('weather')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ current: { temperature: 30 }, air_quality: { pm2_5: 15 } }),
      });
    }
    if (url.includes('oil-prices')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          stations: [
            {
              code: 'PTT',
              fuels: [
                { name: 'ดีเซล', price: 32.94 },
                { name: 'แก๊สโซฮอล์ 95', price: 38.55 },
              ],
            },
          ],
          has_change: false,
        }),
      });
    }
    if (url.includes('market')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          set_index: { value: 1450.2, change: 5.5 },
          currency: { value: 36.1 },
        }),
      });
    }
    return Promise.resolve({ ok: false });
  }),
}));

describe('DailyDigestWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders heading and key metrics', async () => {
    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });
    expect(screen.getByText('สรุปประจำวันอัจฉริยะ')).toBeDefined();
    expect(screen.getByText('Smart Briefing')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('อากาศ')).toBeDefined();
      expect(screen.getByText('น้ำมัน')).toBeDefined();
      expect(screen.getByText('ตลาด SET')).toBeDefined();
      expect(screen.getByText('สิ่งที่ต้องทำ')).toBeDefined();
    });
  });

  it('reads pending tasks from localStorage', async () => {
    localStorage.setItem(
      'quick_notes_tasks',
      JSON.stringify([
        { id: '1', text: 'Task 1', done: false },
        { id: '2', text: 'Task 2', done: true },
        { id: '3', text: 'Task 3', done: false },
      ])
    );

    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });

    await waitFor(() => {
      // 2 pending tasks
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText('รายการค้างอยู่')).toBeDefined();
    });
  });

  it('triggers resize when size button is clicked', async () => {
    const onResize = vi.fn();
    await act(async () => {
      render(<DailyDigestWidget width={2} onResize={onResize} />);
    });
    const resizeBtn = screen.getByTitle('ขนาดเล็ก (1 คอลัมน์)');
    fireEvent.click(resizeBtn);
    expect(onResize).toHaveBeenCalledWith(1);
  });
});
