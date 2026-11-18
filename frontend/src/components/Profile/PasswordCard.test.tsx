import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
const alerts = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showToast: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));
vi.mock('@/utils/sweetalert', () => alerts);
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import PasswordCard from './PasswordCard';

const user = { id: 1, name: 'สมชาย', email: 'somchai@example.com', role: 'user' };

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('รหัสผ่านปัจจุบัน'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), { target: { value: confirm } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /อัปเดตรหัสผ่านใหม่/ }));
}

describe('PasswordCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('will not submit without the current password', () => {
    render(<PasswordCard user={user} />);

    fill('', 'Str0ng!Pass', 'Str0ng!Pass');
    submit();

    expect(alerts.showToast).toHaveBeenCalledWith('กรุณากรอกรหัสผ่านปัจจุบัน', 'warning');
    expect(api.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', () => {
    render(<PasswordCard user={user} />);

    fill('old-password', 'Str0ng!Pass', 'Str0ng!Pas');
    submit();

    expect(alerts.showToast).toHaveBeenCalledWith(
      'รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่',
      'warning',
    );
    expect(api.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('refuses a password the strength meter rates below "ดี"', async () => {
    render(<PasswordCard user={user} />);

    fill('old-password', 'abcdefgh', 'abcdefgh');
    submit();

    expect(alerts.showToast).toHaveBeenCalledWith(
      'รหัสผ่านยังไม่แข็งแรงพอ กรุณาเพิ่มตัวเลขหรืออักขระพิเศษ',
      'warning',
    );
    expect(api.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('posts a strong password and clears the fields', async () => {
    api.fetchWithAuth.mockResolvedValue({ ok: true, json: async () => ({ message: 'ok' }) });
    render(<PasswordCard user={user} />);

    fill('old-password', 'Str0ng!Password', 'Str0ng!Password');
    submit();

    await waitFor(() => expect(alerts.showSuccess).toHaveBeenCalled());
    expect(api.fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({
        old_password: 'old-password',
        new_password: 'Str0ng!Password',
      }),
    });
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveValue('');
  });

  it('asks for the 2FA code when the API demands step-up, then retries once', async () => {
    let changeAttempts = 0;
    api.fetchWithAuth.mockImplementation((url: string) => {
      if (url === '/api/v1/auth/step-up') {
        return Promise.resolve({ ok: true, json: async () => ({ result: 'success' }) });
      }
      changeAttempts += 1;
      if (changeAttempts === 1) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            detail: { code: 'step_up_required', message: 'กรุณากรอกรหัส 2FA อีกครั้ง' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ message: 'ok' }) });
    });

    render(<PasswordCard user={user} />);
    fill('old-password', 'Str0ng!Password', 'Str0ng!Password');
    submit();

    // The action is refused only until the second factor is typed again.
    expect(await screen.findByText('ยืนยันตัวตนอีกครั้ง')).toBeDefined();
    fireEvent.change(screen.getByLabelText('รหัสยืนยัน 6 หลัก หรือรหัสกู้คืน'), {
      target: { value: '123456' },
    });

    await waitFor(() => expect(alerts.showSuccess).toHaveBeenCalled());
    expect(api.fetchWithAuth).toHaveBeenCalledWith('/api/v1/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
    expect(changeAttempts).toBe(2);
  });

  it('shows the served message when the current password is wrong', async () => {
    api.fetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }),
    });
    render(<PasswordCard user={user} />);

    fill('wrong-password', 'Str0ng!Password', 'Str0ng!Password');
    submit();

    await waitFor(() =>
      expect(alerts.showError).toHaveBeenCalledWith('เกิดข้อผิดพลาด', 'รหัสผ่านปัจจุบันไม่ถูกต้อง'),
    );
  });
});
