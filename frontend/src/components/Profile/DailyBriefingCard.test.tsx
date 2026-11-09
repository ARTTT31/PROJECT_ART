import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DailyBriefingCard from './DailyBriefingCard';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';

describe('DailyBriefingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads configuration on mount and renders options', async () => {
    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: 'success',
        data: {
          enabled: true,
          time: '08:00',
          topics: {
            oil_prices: true,
            weather: true,
            market: false,
            tasks: true,
            holidays: true,
          },
        },
      }),
    } as Response);

    render(<DailyBriefingCard />);

    await waitFor(() => {
      expect(screen.getByText('สรุปข้อมูลประจำวันอัตโนมัติ (Daily Push)')).toBeInTheDocument();
      expect(screen.getByText('08:00 น.')).toBeInTheDocument();
      expect(screen.getByText('ราคาน้ำมันขายปลีก')).toBeInTheDocument();
    });
  });

  it('triggers test briefing when test button is clicked', async () => {
    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          data: { enabled: false, time: '07:30', topics: {} },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success' }),
      } as Response);

    render(<DailyBriefingCard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ทดสอบส่ง/i })).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /ทดสอบส่ง/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(fetchWithAuthModule.fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/daily-briefing/test',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
