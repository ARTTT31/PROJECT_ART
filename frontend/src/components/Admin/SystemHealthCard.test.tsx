import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SystemHealthCard } from './SystemHealthCard';

const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: Parameters<typeof mockFetchWithAuth>) => mockFetchWithAuth(...args),
}));

function healthResponse() {
  return {
    ok: true,
    json: async () => ({
      uptime_seconds: 90061,
      database: { status: 'ok', latency_ms: 3.2 },
      cpu_percent: 37.4,
      memory_percent: 62.5,
      memory_used_mb: 4096,
      memory_total_mb: 8192,
      disk_percent: 45.2,
    }),
  } as Response;
}

describe('SystemHealthCard', () => {
  beforeEach(() => {
    mockFetchWithAuth.mockReset();
  });

  it('renders the health payload from the system endpoint', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(healthResponse());

    render(<SystemHealthCard />);

    expect(await screen.findByText('ปกติ')).toBeInTheDocument();
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/v1/system/health', {
      cache: 'no-store',
    });

    // Database latency, uptime and the three resource gauges.
    expect(screen.getByText('ตอบสนอง 3.2 ms')).toBeInTheDocument();
    expect(screen.getByText('1 วัน 1 ชม.')).toBeInTheDocument();
    expect(screen.getByText('37%')).toBeInTheDocument();
    expect(screen.getByText('63%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('ใช้ไป 4 จาก 8 GB')).toBeInTheDocument();
  });

  it('shows an error and retries the probe', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    mockFetchWithAuth.mockResolvedValueOnce(healthResponse());

    render(<SystemHealthCard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('ดึงสถานะระบบไม่สำเร็จ');

    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));

    expect(await screen.findByText('ปกติ')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(2);
  });
});
