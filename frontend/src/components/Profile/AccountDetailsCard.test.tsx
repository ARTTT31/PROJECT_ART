import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), updateUser: vi.fn() }));
const alerts = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ updateUser: api.updateUser }) }));
vi.mock('@/utils/sweetalert', () => alerts);

import AccountDetailsCard from './AccountDetailsCard';

const user = {
  id: 1,
  name: 'สมชาย ใจดี',
  email: 'somchai@example.com',
  role: 'user',
  username: 'somchai',
};

describe('AccountDetailsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts from the signed-in account', () => {
    render(<AccountDetailsCard user={user} onUpdated={vi.fn()} />);

    expect(screen.getByLabelText('ชื่อที่แสดง')).toHaveValue('สมชาย ใจดี');
    expect(screen.getByLabelText('อีเมลสำหรับเข้าสู่ระบบ')).toHaveValue('somchai@example.com');
  });

  it('saves the trimmed name and email, then reports the change upwards', async () => {
    api.fetchWithAuth.mockResolvedValue({ ok: true, json: async () => ({ message: 'ok' }) });
    const onUpdated = vi.fn();
    render(<AccountDetailsCard user={user} onUpdated={onUpdated} />);

    fireEvent.change(screen.getByLabelText('ชื่อที่แสดง'), {
      target: { value: '  สมชาย ใหม่  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /บันทึกข้อมูลส่วนตัว/ }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(api.fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/me', {
      method: 'PUT',
      body: JSON.stringify({ name: 'สมชาย ใหม่', email: 'somchai@example.com' }),
    });
    expect(api.updateUser).toHaveBeenCalledWith({
      name: '  สมชาย ใหม่  ',
      email: 'somchai@example.com',
    });
    expect(alerts.showSuccess).toHaveBeenCalled();
  });

  it('shows the API message when the save is refused', async () => {
    api.fetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'อีเมลนี้ถูกใช้งานแล้ว' }),
    });
    render(<AccountDetailsCard user={user} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /บันทึกข้อมูลส่วนตัว/ }));

    await waitFor(() =>
      expect(alerts.showError).toHaveBeenCalledWith('เกิดข้อผิดพลาด', 'อีเมลนี้ถูกใช้งานแล้ว'),
    );
  });
});
