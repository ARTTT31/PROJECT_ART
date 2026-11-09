import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MyDevicesCard } from './MyDevicesCard';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

const sessions = [
  {
    id: 2,
    session_id: 'session_current',
    device_label: 'Desktop',
    user_agent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ip_address: '203.0.113.10',
    last_activity: '2026-11-09T10:00:00Z',
    created_at: '2026-11-09T09:00:00Z',
    expires_at: '2026-11-16T09:00:00Z',
  },
  {
    id: 1,
    session_id: 'session_phone',
    device_label: 'Mobile',
    user_agent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Version/17.1 Mobile/15E148 Safari/604.1',
    ip_address: '198.51.100.4',
    last_activity: '2026-11-08T10:00:00Z',
    created_at: '2026-11-08T09:00:00Z',
    expires_at: '2026-11-15T09:00:00Z',
  },
];

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('MyDevicesCard', () => {
  it('marks the current device and offers sign-out only for the others', async () => {
    localStorage.setItem('session_id', 'session_current');
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', data: sessions }),
    } as Response);

    render(
      <ToastProvider>
        <MyDevicesCard />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('อุปกรณ์นี้')).toBeDefined();
    });

    expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    expect(screen.getByText(/iPhone OS 17\.1|iOS 17\.1/)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^ออกจากอุปกรณ์ / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /ออกจากอุปกรณ์อื่น/ })).toBeDefined();
  });
});
