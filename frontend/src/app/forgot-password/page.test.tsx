import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ForgotPasswordPage from './page';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    return <img alt="" {...rest} />;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ForgotPasswordPage', () => {
  it('shows the same success message even when the address is unknown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', message: 'sent' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/อีเมลของบัญชี/), {
      target: { value: 'nobody@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ส่งลิงก์ตั้งรหัสผ่าน/ }));

    await waitFor(() => {
      expect(screen.getByText('ส่งลิงก์แล้ว')).toBeDefined();
    });
    expect(screen.getByText(/หากอีเมลนี้มีบัญชีอยู่/)).toBeDefined();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ email: 'nobody@example.com' });
  });
});
