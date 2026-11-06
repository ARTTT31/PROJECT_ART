import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CalendarWidget from './CalendarWidget';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

describe('CalendarWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchWithAuth as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/planner/holidays')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              years: {
                2026: [{ date: '2026-04-13', title: 'วันสงกรานต์' }],
              },
            }),
        });
      }
      if (url.includes('/planner/reminders')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              reminders: [
                { id: 'rem-1', date: '2026-04-13', title: 'ไปเยี่ยมญาติ', kind: 'errand', done: false },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders month header, weekdays, and today button', async () => {
    await act(async () => {
      render(<CalendarWidget width={1} />);
    });
    expect(screen.getByText('ปฏิทิน & ตารางนัดหมาย')).toBeDefined();
    expect(screen.getByText('วันนี้')).toBeDefined();
    expect(screen.getByText('อา')).toBeDefined();
    expect(screen.getByText('จ')).toBeDefined();
    expect(screen.getByText('ศ')).toBeDefined();
  });

  it('navigates next and previous months', async () => {
    await act(async () => {
      render(<CalendarWidget width={1} />);
    });
    const nextBtn = screen.getByRole('button', { name: 'เดือนถัดไป' });
    const prevBtn = screen.getByRole('button', { name: 'เดือนก่อนหน้า' });

    await act(async () => {
      fireEvent.click(nextBtn);
      fireEvent.click(prevBtn);
    });
    expect(screen.getByText('ปฏิทิน & ตารางนัดหมาย')).toBeDefined();
  });

  it('renders in width=2 with day inspector and reminder creation', async () => {
    await act(async () => {
      render(<CalendarWidget width={2} />);
    });
    
    // Find add reminder button
    const addBtn = screen.getByRole('button', { name: /เพิ่มเตือน/i });
    expect(addBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Form input appears
    const input = screen.getByPlaceholderText('พิมพ์ชื่อธุระหรือนัดหมาย...');
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: 'ประชุมด่วน' } });
    const submitBtn = screen.getByText('บันทึก');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/planner/reminders',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('renders in width=3 with full summary columns', async () => {
    await act(async () => {
      render(<CalendarWidget width={3} />);
    });
    expect(screen.getByText(/สรุปวันสำคัญเดือน/i)).toBeDefined();
    expect(screen.getByText('วันหยุดในเดือนนี้')).toBeDefined();
    expect(screen.getByText('นัดหมาย / ธุระ')).toBeDefined();
    expect(screen.getByText('วันลาพักผ่อน')).toBeDefined();
  });
});
