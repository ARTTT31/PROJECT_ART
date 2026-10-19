import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrandingProvider, useBranding } from './BrandingContext'

const { fetchWithAuth } = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
}))

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth }))

function TestComponent() {
  const { companyName, companyTagline, updateBranding } = useBranding()
  return (
    <div>
      <span data-testid="company-name">{companyName}</span>
      <span data-testid="company-tagline">{companyTagline}</span>
      <button
        data-testid="update-btn"
        onClick={() =>
          updateBranding({
            company_name: 'Super Team',
            company_tagline: 'Custom Tagline',
          })
        }
      >
        Update
      </button>
    </div>
  )
}

describe('BrandingContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company_name: 'ART Workspace',
        company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        brand_logo_url: '',
      }),
    }) as unknown as typeof fetch
  })

  it('provides default branding initially', async () => {
    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    )

    expect(screen.getByTestId('company-name').textContent).toBe('ART Workspace')
    expect(screen.getByTestId('company-tagline').textContent).toBe('จัดการวันทำงานของคุณให้ง่ายขึ้น')
  })

  it('updates branding when updateBranding is called', async () => {
    fetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        company_name: 'Super Team',
        company_tagline: 'Custom Tagline',
        brand_logo_url: '',
      }),
    })

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    )

    fireEvent.click(screen.getByTestId('update-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('company-name').textContent).toBe('Super Team')
      expect(screen.getByTestId('company-tagline').textContent).toBe('Custom Tagline')
    })
  })
})
