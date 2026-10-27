'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

export interface BrandingInfo {
  company_name: string
  company_tagline: string
  brand_logo_url?: string
  registration_mode?: string
}

interface BrandingContextValue {
  companyName: string
  companyTagline: string
  brandLogoUrl: string
  registrationMode: string
  isLoading: boolean
  refreshBranding: () => Promise<void>
  updateBranding: (branding: Partial<BrandingInfo>) => Promise<{ success: boolean; error?: string }>
}

const DEFAULT_BRANDING: BrandingInfo = {
  company_name: 'ART Workspace',
  company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
  brand_logo_url: '',
  registration_mode: 'approval',
}

const STORAGE_KEY = 'art_workspace_branding'

const BrandingContext = createContext<BrandingContextValue>({
  companyName: DEFAULT_BRANDING.company_name,
  companyTagline: DEFAULT_BRANDING.company_tagline,
  brandLogoUrl: DEFAULT_BRANDING.brand_logo_url || '',
  registrationMode: DEFAULT_BRANDING.registration_mode || 'approval',
  isLoading: false,
  refreshBranding: async () => {},
  updateBranding: async () => ({ success: false }),
})

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingInfo>(() => {
    if (typeof window === 'undefined') return DEFAULT_BRANDING
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return {
          company_name: parsed.company_name || DEFAULT_BRANDING.company_name,
          company_tagline: parsed.company_tagline ?? DEFAULT_BRANDING.company_tagline,
          brand_logo_url: parsed.brand_logo_url ?? '',
          registration_mode: parsed.registration_mode ?? 'approval',
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_BRANDING
  })

  const [isLoading, setIsLoading] = useState(false)

  // Always use same-origin in the browser so requests go through the Next.js
  // rewrite proxy and cookies are first-party.
  const apiBaseUrl = typeof window !== 'undefined' && !process.env.VITEST ? '' : (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/system/branding`)
      if (res.ok) {
        const data = await res.json()
        const newBranding: BrandingInfo = {
          company_name: data.company_name || DEFAULT_BRANDING.company_name,
          company_tagline: data.company_tagline ?? DEFAULT_BRANDING.company_tagline,
          brand_logo_url: data.brand_logo_url || '',
          registration_mode: data.registration_mode || 'approval',
        }
        setBranding(newBranding)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newBranding))
        } catch {
          // ignore storage errors
        }
      }
    } catch {
      // ignore network errors, keep cached/default
    }
  }, [apiBaseUrl])

  useEffect(() => {
    refreshBranding()
  }, [refreshBranding])

  const updateBranding = async (newValues: Partial<BrandingInfo>) => {
    setIsLoading(true)
    try {
      const payload = {
        company_name: newValues.company_name ?? branding.company_name,
        company_tagline: newValues.company_tagline ?? branding.company_tagline,
        brand_logo_url: newValues.brand_logo_url ?? branding.brand_logo_url,
        registration_mode: newValues.registration_mode ?? branding.registration_mode,
      }

      const res = await fetchWithAuth('/api/v1/system/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = errData.detail || errData.message || 'ไม่สามารถบันทึกข้อมูลการตั้งค่าแบรนด์ได้'
        return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) }
      }

      const updated = await res.json()
      const savedBranding: BrandingInfo = {
        company_name: updated.company_name,
        company_tagline: updated.company_tagline,
        brand_logo_url: updated.brand_logo_url || '',
        registration_mode: updated.registration_mode || 'approval',
      }
      setBranding(savedBranding)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBranding))
      } catch {
        // ignore
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <BrandingContext.Provider
      value={{
        companyName: branding.company_name,
        companyTagline: branding.company_tagline,
        brandLogoUrl: branding.brand_logo_url || '',
        registrationMode: branding.registration_mode || 'approval',
        isLoading,
        refreshBranding,
        updateBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
