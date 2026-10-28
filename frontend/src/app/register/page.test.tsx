import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from './page';
import { BrandingProvider } from '@/context/BrandingContext';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
  }),
}));

vi.mock('@/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders form fields when registration mode is approval', async () => {
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
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <RegisterPage />
      </BrandingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/สมชาย/)).toBeTruthy();
    });

    expect(screen.getByPlaceholderText('name@example.com')).toBeTruthy();
  });

  it('shows closed notice when registration mode is closed', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: 'success',
            data: { registration_mode: 'closed' },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <RegisterPage />
      </BrandingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ปิดรับสมัครสมาชิกชั่วคราว')).toBeTruthy();
    });
  });

  it('submits registration in approval mode and shows pending screen', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: 'success',
            data: { registration_mode: 'approval' },
          }),
        });
      }
      if (url.includes('register') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: 'success',
            message: 'คำขอสมัครอยู่ระหว่างรออนุมัติ',
            data: { status: 'pending' },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      });
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <RegisterPage />
      </BrandingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/สมชาย/)).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/สมชาย/), {
      target: { value: 'สมชาย ใจดี' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'somchai@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], {
      target: { value: 'Password123!' },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: 'Password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'ส่งคำขอสมัครสมาชิก' }));

    await waitFor(() => {
      expect(screen.getByText('ส่งคำขอสมัครสมาชิกสำเร็จแล้ว')).toBeTruthy();
      expect(screen.getByText(/ระบบนี้กำหนดให้แอดมินอนุมัติก่อนเข้าใช้งาน/)).toBeTruthy();
    });
  });
});
