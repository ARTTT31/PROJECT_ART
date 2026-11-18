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

const ok = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const stepUpRequired = {
  ok: false,
  status: 403,
  json: async () => ({ detail: { code: 'step_up_required' } }),
} as Response;

function renderCard() {
  render(
    <ToastProvider>
      <TrustedDevicesCard />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TrustedDevicesCard', () => {
  it('lists a trusted browser with the date its 2FA bypass ends', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(ok({ result: 'success', data: devices }));

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    });
    expect(screen.getByText(/ข้ามการยืนยันถึง/)).toBeDefined();
    expect(screen.getByRole('button', { name: /เพิกถอน Chrome 120/ })).toBeDefined();
  });

  it('revokes one device and reloads the list', async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(ok({ result: 'success', data: devices }))
      .mockResolvedValueOnce(ok({ result: 'success' }))
      .mockResolvedValueOnce(ok({ result: 'success', data: [] }));

    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /เพิกถอน Chrome 120/ }));

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีอุปกรณ์ที่ถูกจดจำ/)).toBeDefined();
    });
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/auth/2fa/trusted-devices/7', {
      method: 'DELETE',
    });
  });

  it('asks for a 2FA code before revoking every device, then retries', async () => {
    let deletes = 0;

    vi.mocked(fetchWithAuth).mockImplementation(async (url, init) => {
      if (url === '/api/v1/auth/step-up') return ok({ result: 'success' });
      if (init?.method === 'DELETE') {
        return ++deletes === 1 ? stepUpRequired : ok({ result: 'success' });
      }
      return ok({ result: 'success', data: deletes ? [] : devices });
    });

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /เพิกถอนทั้งหมด/ }));

    fireEvent.change(await screen.findByLabelText('รหัสยืนยัน 6 หลัก หรือรหัสกู้คืน'), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีอุปกรณ์ที่ถูกจดจำ/)).toBeDefined();
    });
    expect(deletes).toBe(2);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
  });

  it('keeps the list when the code prompt is cancelled', async () => {
    let deletes = 0;
    vi.mocked(fetchWithAuth).mockImplementation(async (_url, init) => {
      if (init?.method === 'DELETE') {
        deletes += 1;
        return stepUpRequired;
      }
      return ok({ result: 'success', data: devices });
    });

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /เพิกถอนทั้งหมด/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'ยกเลิก' }));

    await waitFor(() => {
      expect(screen.queryByText('ยืนยันตัวตนอีกครั้ง')).toBeNull();
    });
    expect(deletes).toBe(1);
    expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
  });
});
