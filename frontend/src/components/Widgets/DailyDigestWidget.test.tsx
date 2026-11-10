import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DailyDigestWidget from './DailyDigestWidget';
import { shareOrDownloadDailyCard } from '@/utils/cardGenerator';

vi.mock('@/utils/cardGenerator', () => ({
  shareOrDownloadDailyCard: vi.fn().mockResolvedValue(undefined),
}));

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
          prices: [
            { key: 'diesel', name: 'ดีเซล', price: 32.94, unit: 'บาท/ลิตร' },
            { key: 'gasohol_95', name: 'แก๊สโซฮอล์ 95', price: 38.55, unit: 'บาท/ลิตร' },
            {
              key: 'benzene_95',
              name: 'เบนซิน 95',
              price: 47.54,
              unit: 'บาท/ลิตร',
            },
          ],
          is_stale: false,
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
    // The old "AI" chip was removed from the title.
    expect(screen.queryByText('AI')).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('อากาศ')).toBeDefined();
      expect(
        screen.getByRole('combobox', { name: 'เลือกชนิดน้ำมันที่แสดงบนสรุปประจำวัน' }),
      ).toBeDefined();
      expect(screen.getByText('ตลาด SET')).toBeDefined();
      expect(screen.getByText('สิ่งที่ต้องทำ')).toBeDefined();
    });
  });

  it('reads pending tasks from the Quick Notes cache', async () => {
    localStorage.setItem(
      'artOffline:v1:local:cache:profile/quick-notes',
      JSON.stringify({
        savedAt: Date.now(),
        data: {
          notes: [
            { id: '1', text: 'Task 1', done: false },
            { id: '2', text: 'Task 2', done: true },
            { id: '3', text: 'Task 3', done: false },
          ],
        },
      }),
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

  it('switches the oil tile to another fuel type', async () => {
    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });

    await waitFor(() => expect(screen.getAllByText('฿32.94').length).toBeGreaterThan(0));

    fireEvent.click(
      screen.getByRole('combobox', { name: 'เลือกชนิดน้ำมันที่แสดงบนสรุปประจำวัน' }),
    );
    fireEvent.click(screen.getByRole('option', { name: 'เบนซิน 95' }));

    expect(screen.getAllByText('฿47.54').length).toBeGreaterThan(0);
    expect(localStorage.getItem('artDigestFuelV1')).toBe('benzene_95');
  });

  it('paints the last saved digest immediately instead of waiting on the network', async () => {
    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');
    // Keep the mount refresh in flight: whatever is asserted must come from the
    // cache. Only the three requests of this mount hang; later tests get the
    // default mock back.
    const pending = () => new Promise<Response>(() => {});
    vi.mocked(fetchWithAuth)
      .mockImplementationOnce(pending)
      .mockImplementationOnce(pending)
      .mockImplementationOnce(pending);
    localStorage.setItem(
      'artOffline:v1:local:cache:dashboard/digest',
      JSON.stringify({
        savedAt: Date.now(),
        data: {
          weather: { temp: 29, condition: 'มีเมฆเป็นส่วนมาก', pm25: 22 },
          oil: { diesel: 33.1, gasohol95: 39.5, status: 'ราคาคงที่' },
          market: { setIndex: 1402.5, setChange: -3.4, usdRate: 35.2 },
          pendingTasks: 2,
        },
      }),
    );

    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });

    // 29°C shows in both the narrative banner and the weather tile.
    expect(screen.getAllByText('29°C').length).toBeGreaterThan(0);
    expect(screen.getAllByText('฿33.1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1402.5').length).toBeGreaterThan(0);
    expect(screen.queryByText(/กำลังประมวลผลข้อมูลสรุปประจำวัน/)).toBeNull();
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

  it('displays the appropriate time-of-day greeting in the narrative banner', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 8, 30));
    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });
    expect(screen.getByText(/สวัสดีตอนเช้า — ภาพรวมพร้อมสำหรับคุณ/)).toBeDefined();

    vi.setSystemTime(new Date(2026, 10, 9, 23, 15));
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText(/ราตรีสวัสดิ์ — ภาพรวมพร้อมสำหรับคุณ/)).toBeDefined();

    vi.useRealTimers();
  });

  it('triggers shareOrDownloadDailyCard when share card button is clicked', async () => {
    await act(async () => {
      render(<DailyDigestWidget width={2} />);
    });
    const shareBtn = screen.getByLabelText('แชร์การ์ดสรุปประจำวัน');
    await act(async () => {
      fireEvent.click(shareBtn);
    });
    expect(shareOrDownloadDailyCard).toHaveBeenCalled();
  });
});
