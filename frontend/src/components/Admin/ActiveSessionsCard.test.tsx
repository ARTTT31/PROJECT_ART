import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ActiveSessionsCard from './ActiveSessionsCard';
import { describeDevice } from '@/utils/userAgent';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/utils/sweetalert', () => ({
  showDeleteConfirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
  showToast: vi.fn(),
}));

const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('describeDevice', () => {
  it('keeps a specific stored label', () => {
    expect(describeDevice(WINDOWS_CHROME, 'iPad Pro')).toBe('iPad Pro');
  });

  it('replaces a generic label with browser and OS from the user agent', () => {
    expect(describeDevice(WINDOWS_CHROME, 'Desktop')).toBe('Chrome 120 · Windows 10/11');
  });

  it('falls back to the generic label when the user agent is unusable', () => {
    expect(describeDevice(null, 'Mobile')).toBe('Mobile');
  });

  it('says so when nothing identifies the device', () => {
    expect(describeDevice(null, null)).toBe('ไม่ระบุอุปกรณ์');
  });
});

const sessions = [
  {
    id: 1,
    session_id: 'session_current',
    user_id: 7,
    email: 'owner@example.com',
    username: 'owner',
    name: 'Owner',
    role: 'admin',
    device_label: 'Desktop',
    user_agent: WINDOWS_CHROME,
    // The API still sends the address; the card must not print it.
    ip_address: '203.0.113.10',
    is_active: true,
    is_online: true,
    last_activity: '2026-11-23T09:00:00Z',
    created_at: '2026-11-23T08:00:00Z',
    expires_at: '2026-11-30T08:00:00Z',
  },
];

function ok(rows: unknown[]) {
  return {
    ok: true,
    json: async () => rows,
    headers: new Headers({ 'X-Total-Count': String(rows.length) }),
  } as unknown as Response;
}

describe('ActiveSessionsCard', () => {
  it('renders the device and its activity but never the stored address', async () => {
    localStorage.setItem('session_id', 'session_current');
    vi.mocked(fetchWithAuth).mockResolvedValue(ok(sessions));

    const { container } = render(<ActiveSessionsCard />);

    await waitFor(() => {
      expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    });
    expect(screen.getByText(/ใช้งานล่าสุด/)).toBeDefined();
    expect(container.textContent).not.toContain('203.0.113.10');
    expect(screen.getByPlaceholderText('ค้นหาชื่อ อีเมล หรืออุปกรณ์')).toBeDefined();
  });
});
