import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ActiveSessionsCard from './ActiveSessionsCard';
import { describeDevice } from '@/utils/userAgent';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { showDeleteConfirm, showToast } from '@/utils/sweetalert';

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

  it('groups one account\'s devices under a single heading', async () => {
    localStorage.setItem('session_id', 'session_current');
    const ANDROID_CHROME =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36';
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        {
          ...sessions[0],
          id: 2,
          session_id: 'session_phone',
          device_label: 'Mobile',
          user_agent: ANDROID_CHROME,
          is_online: false,
          last_activity: '2026-11-22T18:00:00Z',
        },
      ]),
    );

    const { container } = render(<ActiveSessionsCard />);

    await waitFor(() => {
      expect(screen.getByText('2 อุปกรณ์')).toBeDefined();
    });
    // The account is named once; the devices are what repeat.
    expect(screen.getAllByText('Owner')).toHaveLength(1);
    expect(screen.getByText('Chrome 120 · Windows 10/11')).toBeDefined();
    expect(screen.getByText('Chrome 157 · Android 10')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'บังคับ Owner ออกจาก Chrome 120 · Windows 10/11' }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'บังคับ Owner ออกจาก Chrome 157 · Android 10' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'บังคับ Owner ออกจากทุกอุปกรณ์' })).toBeDefined();
    expect(container.textContent).not.toContain('203.0.113.10');
  });

  it('revokes every session of that account from the group button, and only that account', async () => {
    localStorage.setItem('session_id', 'session_current');
    const ANDROID_CHROME =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36';
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        {
          ...sessions[0],
          id: 2,
          session_id: 'session_phone',
          device_label: 'Mobile',
          user_agent: ANDROID_CHROME,
        },
        {
          ...sessions[0],
          id: 3,
          session_id: 'session_other',
          user_id: 9,
          name: 'Someone Else',
          email: 'other@example.com',
        },
      ]),
    );

    render(<ActiveSessionsCard />);

    await waitFor(() => {
      expect(screen.getByText('Someone Else')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'บังคับ Owner ออกจากทุกอุปกรณ์' }));

    await waitFor(() => {
      const deleted = vi
        .mocked(fetchWithAuth)
        .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')
        .map(([url]) => String(url).split('/').pop());
      expect(deleted.sort()).toEqual(['session_current', 'session_phone']);
    });
  });

  it('warns that this device is included when the group is your own account', async () => {
    localStorage.setItem('session_id', 'session_phone');
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        { ...sessions[0], id: 2, session_id: 'session_phone', device_label: 'Mobile' },
        {
          ...sessions[0],
          id: 3,
          session_id: 'session_other',
          user_id: 9,
          name: 'Someone Else',
          email: 'other@example.com',
        },
      ]),
    );
    vi.mocked(showDeleteConfirm).mockClear();

    render(<ActiveSessionsCard />);
    await waitFor(() => {
      expect(screen.getByText('Someone Else')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'บังคับ Owner ออกจากทุกอุปกรณ์' }));

    await waitFor(() => {
      expect(vi.mocked(showDeleteConfirm)).toHaveBeenCalledTimes(1);
    });
    const [, ownText] = vi.mocked(showDeleteConfirm).mock.calls[0];
    expect(ownText).toContain('รวมอุปกรณ์นี้ด้วย');
    expect(ownText).toContain('หลุดจากระบบทันที');

    // Another account's group carries no such warning.
    vi.mocked(showDeleteConfirm).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'บังคับ Someone Else ออกจากทุกอุปกรณ์' }));

    await waitFor(() => {
      expect(vi.mocked(showDeleteConfirm)).toHaveBeenCalledTimes(1);
    });
    const [, otherText] = vi.mocked(showDeleteConfirm).mock.calls[0];
    expect(otherText).not.toContain('รวมอุปกรณ์นี้ด้วย');
  });

  it('warns before a per-device revoke that ends this very device', async () => {
    localStorage.setItem('session_id', 'session_current');
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        { ...sessions[0], id: 2, session_id: 'session_tablet', device_label: 'iPad Pro' },
      ]),
    );
    vi.mocked(showDeleteConfirm).mockClear();

    render(<ActiveSessionsCard />);
    await waitFor(() => {
      expect(screen.getByText('2 อุปกรณ์')).toBeDefined();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'บังคับ Owner ออกจาก Chrome 120 · Windows 10/11' }),
    );
    await waitFor(() => {
      expect(vi.mocked(showDeleteConfirm)).toHaveBeenCalledTimes(1);
    });
    const [, currentText] = vi.mocked(showDeleteConfirm).mock.calls[0];
    expect(currentText).toContain('อุปกรณ์นี้คือเครื่องที่คุณกำลังใช้อยู่');
    expect(currentText).toContain('หลุดจากระบบทันที');

    // Another device of the same account keeps the plain sentence.
    vi.mocked(showDeleteConfirm).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'บังคับ Owner ออกจาก iPad Pro' }));
    await waitFor(() => {
      expect(vi.mocked(showDeleteConfirm)).toHaveBeenCalledTimes(1);
    });
    const [, otherDeviceText] = vi.mocked(showDeleteConfirm).mock.calls[0];
    expect(otherDeviceText).not.toContain('อุปกรณ์นี้คือเครื่องที่คุณกำลังใช้อยู่');
  });

  it('leaves for the login screen after revoking this very device', async () => {
    localStorage.setItem('session_id', 'session_current');
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        { ...sessions[0], id: 2, session_id: 'session_tablet', device_label: 'iPad Pro' },
      ]),
    );

    const onLogout = vi.fn();
    window.addEventListener('auth-logout', onLogout);
    const listRequests = () =>
      vi
        .mocked(fetchWithAuth)
        .mock.calls.filter(([url]) => !String(url).includes('/sessions/')).length;

    try {
      render(<ActiveSessionsCard />);
      await waitFor(() => {
        expect(screen.getByText('2 อุปกรณ์')).toBeDefined();
      });
      const before = listRequests();
      vi.mocked(showToast).mockClear();

      fireEvent.click(
        screen.getByRole('button', { name: 'บังคับ Owner ออกจาก Chrome 120 · Windows 10/11' }),
      );

      await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
      expect(vi.mocked(showToast)).toHaveBeenCalledWith(expect.any(String), 'success');
      // The list is not refetched — there is no session left to fetch it with.
      expect(listRequests()).toBe(before);
    } finally {
      window.removeEventListener('auth-logout', onLogout);
    }
  });

  it('leaves for the login screen after revoking every device of its own account', async () => {
    localStorage.setItem('session_id', 'session_phone');
    vi.mocked(fetchWithAuth).mockResolvedValue(
      ok([
        sessions[0],
        { ...sessions[0], id: 2, session_id: 'session_phone', device_label: 'iPad Pro' },
        {
          ...sessions[0],
          id: 3,
          session_id: 'session_other',
          user_id: 9,
          name: 'Someone Else',
          email: 'other@example.com',
        },
      ]),
    );

    const onLogout = vi.fn();
    window.addEventListener('auth-logout', onLogout);

    try {
      render(<ActiveSessionsCard />);
      await waitFor(() => {
        expect(screen.getByText('Someone Else')).toBeDefined();
      });

      // Another account's batch leaves this browser signed in.
      fireEvent.click(screen.getByRole('button', { name: 'บังคับ Someone Else ออกจากทุกอุปกรณ์' }));
      await waitFor(() => {
        const deleted = vi
          .mocked(fetchWithAuth)
          .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE');
        expect(deleted).toHaveLength(1);
      });
      expect(onLogout).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'บังคับ Owner ออกจากทุกอุปกรณ์' }));
      await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
    } finally {
      window.removeEventListener('auth-logout', onLogout);
    }
  });

  it('still leaves when this device is gone but another one refused', async () => {
    localStorage.setItem('session_id', 'session_current');
    const rows = [
      sessions[0],
      { ...sessions[0], id: 2, session_id: 'session_phone', device_label: 'iPad Pro' },
    ];
    vi.mocked(fetchWithAuth).mockImplementation(async (url, init) => {
      if (
        (init as RequestInit | undefined)?.method === 'DELETE' &&
        String(url).includes('session_phone')
      ) {
        return {
          ok: false,
          json: async () => ({ detail: 'boom' }),
          headers: new Headers(),
        } as unknown as Response;
      }
      return ok(rows);
    });

    const onLogout = vi.fn();
    window.addEventListener('auth-logout', onLogout);
    vi.mocked(showToast).mockClear();

    try {
      render(<ActiveSessionsCard />);
      await waitFor(() => {
        expect(screen.getByText('2 อุปกรณ์')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'บังคับ Owner ออกจากทุกอุปกรณ์' }));

      await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
      expect(vi.mocked(showToast)).toHaveBeenCalledWith(
        'เครื่องนี้หลุดจากระบบแล้ว · อีก 1 อุปกรณ์ออกไม่สำเร็จ',
        'warning',
      );
    } finally {
      window.removeEventListener('auth-logout', onLogout);
    }
  });

  it('explains an account with no devices and links back to its history', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(ok([]));

    render(<ActiveSessionsCard initialQuery="owner@example.com" />);

    const link = await screen.findByRole('link', {
      name: /ดูบันทึกกิจกรรมของบัญชีนี้/,
    });
    expect(link.getAttribute('href')).toBe('/audit?q=owner%40example.com');
    expect(screen.getByText(/บัญชีนี้ไม่ได้เข้าสู่ระบบอยู่/)).toBeDefined();
  });

  it('starts filtered to the account it was opened for', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(ok(sessions));

    render(<ActiveSessionsCard initialQuery="owner@example.com" />);

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalled());
    expect(String(vi.mocked(fetchWithAuth).mock.calls[0][0])).toContain('q=owner%40example.com');
    expect(screen.getByPlaceholderText('ค้นหาชื่อ อีเมล หรืออุปกรณ์')).toHaveValue(
      'owner@example.com',
    );
  });
});
