import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrustedDevicesCard } from './TrustedDevicesCard';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/utils/sweetalert', () => ({
  showConfirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
}));

const devices = [
  {
    id: 7,
    device_label: 'Desktop',
    user_agent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ip_address: '203.0.113.10',
    created_at: '2026-11-09T09:00:00Z',
    last_used_at: '2026-11-10T10:00:00Z',
    expires_at: '2026-12-09T09:00:00Z',
  },
];

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TrustedDevicesCard', () => {
  it('lists a trusted browser with the date its 2FA bypass ends', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse({ result: 'success', data: devices }),
    );

    render(
      <ToastProvider>
        <TrustedDevicesCard />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    });
    expect(screen.getByText(/ข้ามการยืนยันถึง/)).toBeDefined();
    expect(screen.getByRole('button', { name: /เพิกถอน Chrome 120/ })).toBeDefined();
  });

  it('revokes one device and reloads the list', async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(jsonResponse({ result: 'success', data: devices }))
      .mockResolvedValueOnce(jsonResponse({ result: 'success' }))
      .mockResolvedValueOnce(jsonResponse({ result: 'success', data: [] }));

    render(
      <ToastProvider>
        <TrustedDevicesCard />
      </ToastProvider>,
    );

    const revokeButton = await screen.findByRole('button', {
      name: /เพิกถอน Chrome 120/,
    });
    fireEvent.click(revokeButton);

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีอุปกรณ์ที่ถูกจดจำ/)).toBeDefined();
    });

    const [call] = vi
      .mocked(fetchWithAuth)
      .mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(call).toBeDefined();
    expect(String(call[0])).toBe('/api/v1/auth/2fa/trusted-devices/7');
  });
});
