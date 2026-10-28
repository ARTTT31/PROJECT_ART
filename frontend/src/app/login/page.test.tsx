import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { BrandingProvider } from '@/context/BrandingContext';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
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
  }),
}));

vi.mock('@/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      });
    }) as unknown as typeof fetch;
  });

  it('renders sign-in form along with permanent register link to /register', () => {
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
