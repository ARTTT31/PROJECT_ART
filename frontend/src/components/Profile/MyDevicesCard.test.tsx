import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyDevicesCard } from './MyDevicesCard';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/utils/sweetalert', () => ({
  showConfirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
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

const ok = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const stepUpRequired = {
  ok: false,
  status: 403,
  json: async () => ({ detail: { code: 'step_up_required' } }),
} as Response;

function renderCard() {
  render(
    <ToastProvider>
      <MyDevicesCard />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('MyDevicesCard', () => {
  it('marks the current device and offers sign-out only for the others', async () => {
    localStorage.setItem('session_id', 'session_current');
    vi.mocked(fetchWithAuth).mockResolvedValue(ok({ result: 'success', data: sessions }));

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('อุปกรณ์นี้')).toBeDefined();
    });

    expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    expect(screen.getByText(/iPhone OS 17\.1|iOS 17\.1/)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^ออกจากอุปกรณ์ / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /ออกจากอุปกรณ์อื่น/ })).toBeDefined();
  });

  it('asks for a 2FA code before signing other devices out, then retries', async () => {
    localStorage.setItem('session_id', 'session_current');
    let deletes = 0;

    vi.mocked(fetchWithAuth).mockImplementation(async (url, init) => {
      if (url === '/api/v1/auth/step-up') return ok({ result: 'success' });
      if (init?.method === 'DELETE') {
        return ++deletes === 1 ? stepUpRequired : ok({ result: 'success' });
      }
      return ok({ result: 'success', data: deletes ? [] : sessions });
    });

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /ออกจากอุปกรณ์อื่น/ }));

    fireEvent.change(await screen.findByLabelText('รหัสยืนยัน 6 หลัก หรือรหัสกู้คืน'), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(screen.getByText('ไม่พบอุปกรณ์ที่เข้าสู่ระบบอยู่')).toBeDefined();
    });
    expect(deletes).toBe(2);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
  });
});
