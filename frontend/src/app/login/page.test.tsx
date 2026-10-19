import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from './page'
import { BrandingProvider } from '@/context/BrandingContext'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
  }),
}))

vi.mock('@/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@/components/Auth/TurnstileWidget', () => ({
  default: () => <div data-testid="turnstile-widget" />,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('registration-mode')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: 'success',
            data: { registration_mode: 'approval' },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        }),
      })
    }) as unknown as typeof fetch
  })

  it('renders sign-in form along with permanent register link to /register', () => {
    render(
      <BrandingProvider>
        <LoginPage />
      </BrandingProvider>
    )

    // Verify registration prompt and button exist
    expect(screen.getByText('ยังไม่มีบัญชีสำหรับใช้งาน?')).toBeDefined()
    const registerLink = screen.getByRole('link', { name: /สมัครสมาชิก/i })
    expect(registerLink).toBeDefined()
    expect(registerLink.getAttribute('href')).toBe('/register')
  })
})
