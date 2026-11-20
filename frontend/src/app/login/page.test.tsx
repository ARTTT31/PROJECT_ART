import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { BrandingProvider } from '@/context/BrandingContext';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

const authState = vi.hoisted(() => ({
  status: 'unauthenticated' as 'unauthenticated' | 'authenticated',
  user: null as null | { role: string },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: authState.status,
    user: authState.user,
    login: vi.fn(),
  }),
}));

vi.mock('@/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    addToast: vi.fn(),
  }),
}));

vi.mock('@/components/Auth/TurnstileWidget', () => ({
  default: () => <div data-testid="turnstile-widget" />,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.status = 'unauthenticated';
    authState.user = null;
    window.history.replaceState({}, '', '/login');
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: 'success',
            data: { registration_mode: 'approval' },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          company_name: 'Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      });
    }) as unknown as typeof fetch;
  });

  it('renders sign-in form along with permanent register link to /register', async () => {
    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    // Verify registration prompt and button exist
    expect(screen.getByText('ยังไม่มีบัญชีสำหรับใช้งาน?')).toBeDefined();
    const registerLink = screen.getByRole('link', { name: /สมัครสมาชิก/i });
    expect(registerLink).toBeDefined();
    expect(registerLink.getAttribute('href')).toBe('/register');

    // Google sign-in is still gone; password reset is self-service again.
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    const forgotLink = screen.getByRole('link', { name: /ลืมรหัสผ่าน/ });
    expect(forgotLink.getAttribute('href')).toBe('/forgot-password');

    // Wait for on-mount fetches (branding + registration-mode) to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('asks for the second factor in a dialog, not in the sign-in form', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ result: 'success', data: { registration_mode: 'approval' } }),
        });
      }
      if (String(url).includes('/auth/login')) {
        return Promise.resolve({ ok: true, json: async () => ({ result: 'totp_required' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ company_name: 'Workspace', company_tagline: 'x' }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    // The code field is not part of the form before the API asks for it.
    expect(screen.queryByLabelText('รหัสยืนยัน 6 หลัก')).toBeNull();

    fireEvent.change(screen.getByLabelText('อีเมล หรือ ชื่อผู้ใช้'), {
      target: { value: 'admin@art.com' },
    });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.anything(),
      );
    });

    expect(await screen.findByText('ยืนยันตัวตน 2 ขั้นตอน')).toBeDefined();
    expect(screen.getByLabelText('รหัสยืนยัน 6 หลัก')).toBeDefined();
  });

  it('allows switching to recovery code mode and toggling trust device', async () => {
    let capturedPayload: any = null;
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (String(url).includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ result: 'success', data: { registration_mode: 'approval' } }),
        });
      }
      if (String(url).includes('/auth/login')) {
        if (options?.body) {
          capturedPayload = JSON.parse(options.body);
          if (!capturedPayload.totp_code && !capturedPayload.recovery_code) {
            return Promise.resolve({ ok: true, json: async () => ({ result: 'totp_required' }) });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ result: 'success', data: { session_id: 's1', user: { role: 'user' } } }),
          });
        }
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ company_name: 'Workspace', company_tagline: 'x' }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    // Initial login submission
    fireEvent.change(screen.getByLabelText('อีเมล หรือ ชื่อผู้ใช้'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    // 2FA Dialog appears
    expect(await screen.findByText('ยืนยันตัวตน 2 ขั้นตอน')).toBeDefined();
    const totpInput = screen.getByLabelText('รหัสยืนยัน 6 หลัก') as HTMLInputElement;
    expect(totpInput.getAttribute('inputmode')).toBe('numeric');

    // Trust device is opt-in: unticked until the user asks for it.
    const trustCheckbox = screen.getByLabelText(/จดจำอุปกรณ์นี้ 30 วัน/i) as HTMLInputElement;
    expect(trustCheckbox).toBeDefined();
    expect(trustCheckbox.checked).toBe(false);
    fireEvent.click(trustCheckbox);
    expect(trustCheckbox.checked).toBe(true);

    // Switch to recovery code mode
    const recoveryBtn = screen.getByRole('button', { name: /ทำโทรศัพท์หาย\? ใช้รหัสกู้คืน/i });
    fireEvent.click(recoveryBtn);

    // Now in recovery mode
    expect(await screen.findByText('เข้าสู่ระบบด้วยรหัสสำรอง')).toBeDefined();
    const recoveryInput = screen.getByLabelText('รหัสกู้คืน') as HTMLInputElement;
    expect(recoveryInput.getAttribute('inputmode')).toBe('text');
    expect(recoveryInput.getAttribute('placeholder')).toBe('ABCDE-12345');

    // Type recovery code
    fireEvent.change(recoveryInput, { target: { value: 'a1b2c-3d4e5' } });
    expect(recoveryInput.value).toBe('A1B2C-3D4E5');

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันและเข้าสู่ระบบ/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.recovery_code).toBe('A1B2C-3D4E5');
      expect(capturedPayload.trust_device).toBe(true);
    });
  });

  it('normalises a pasted recovery code and cools down after a wrong code', async () => {
    const payloads: any[] = [];
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (String(url).includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ result: 'success', data: { registration_mode: 'approval' } }),
        });
      }
      if (String(url).includes('/auth/login')) {
        const body = options?.body ? JSON.parse(options.body) : {};
        payloads.push(body);
        // Every code attempt is answered with "still required", which is how
        // the API reports a wrong second factor.
        return Promise.resolve({ ok: true, json: async () => ({ result: 'totp_required' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ company_name: 'Workspace', company_tagline: 'x' }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    fireEvent.change(screen.getByLabelText('อีเมล หรือ ชื่อผู้ใช้'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    await screen.findByText('ยืนยันตัวตน 2 ขั้นตอน');

    fireEvent.click(screen.getByRole('button', { name: /ทำโทรศัพท์หาย\? ใช้รหัสกู้คืน/i }));
    const recoveryInput = (await screen.findByLabelText('รหัสกู้คืน')) as HTMLInputElement;

    // A paste usually arrives with no dash, lowercase, or with a space.
    fireEvent.change(recoveryInput, { target: { value: 'abcde 12345' } });
    expect(recoveryInput.value).toBe('ABCDE-12345');

    fireEvent.click(screen.getByRole('button', { name: /ยืนยันและเข้าสู่ระบบ/i }));
    await waitFor(() => {
      expect(payloads[payloads.length - 1].recovery_code).toBe('ABCDE-12345');
    });

    // A rejected code locks the button briefly instead of inviting a machine-gun
    // retry; the API backoff still applies underneath.
    await waitFor(() => {
      const submit = screen.getByRole('button', { name: /ยืนยันและเข้าสู่ระบบ/i });
      expect((submit as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getByText(/ลองใหม่ได้ในอีก/)).toBeDefined();
  });

  it('submits a complete six-digit code and keeps the device tick after a wrong one', async () => {
    const payloads: any[] = [];
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (String(url).includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ result: 'success', data: { registration_mode: 'approval' } }),
        });
      }
      if (String(url).includes('/auth/login')) {
        payloads.push(options?.body ? JSON.parse(options.body) : {});
        // Every code attempt is answered with "still required", which is how the
        // API reports a wrong second factor.
        return Promise.resolve({ ok: true, json: async () => ({ result: 'totp_required' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ company_name: 'Workspace', company_tagline: 'x' }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    fireEvent.change(screen.getByLabelText('อีเมล หรือ ชื่อผู้ใช้'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    const totpInput = (await screen.findByLabelText('รหัสยืนยัน 6 หลัก')) as HTMLInputElement;

    const trustCheckbox = screen.getByLabelText(/จดจำอุปกรณ์นี้ 30 วัน/i) as HTMLInputElement;
    fireEvent.click(trustCheckbox);
    expect(trustCheckbox.checked).toBe(true);

    // Six digits is the whole code — no click on the submit button.
    fireEvent.change(totpInput, { target: { value: '123456' } });
    await waitFor(() => {
      expect(payloads.some((payload) => payload.totp_code === '123456')).toBe(true);
    });

    // The rejected code keeps the dialog (and the choice to trust this browser)
    // exactly as the user left it.
    expect(await screen.findByText('ยืนยันตัวตน 2 ขั้นตอน')).toBeDefined();
    expect(
      (screen.getByLabelText(/จดจำอุปกรณ์นี้ 30 วัน/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText(/ลองใหม่ได้ในอีก/)).toBeDefined();
  });

  it('returns to the ?next page once a session is restored', async () => {
    // The approval alert email is a deep link. If the admin was signed out,
    // AuthGuard sends them to /login?next=… and login must honour it.
    authState.status = 'authenticated';
    window.history.replaceState({}, '', '/login?next=%2Fprofile%3Ftab%3Dadmin');

    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/profile?tab=admin');
    });
  });
});
