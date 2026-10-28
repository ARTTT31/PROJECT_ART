'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

export interface BrandingInfo {
  company_name: string;
  company_tagline: string;
  brand_logo_url?: string;
  registration_mode?: string;
}

interface BrandingContextValue {
  companyName: string;
  companyTagline: string;
  brandLogoUrl: string;
  registrationMode: string;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (
    branding: Partial<BrandingInfo>,
  ) => Promise<{ success: boolean; error?: string }>;
  uploadBrandLogo: (file: File) => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_BRANDING: BrandingInfo = {
  company_name: 'ART Workspace',
  company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
  brand_logo_url: '',
  registration_mode: 'approval',
};

const STORAGE_KEY = 'art_workspace_branding';

const BrandingContext = createContext<BrandingContextValue>({
  companyName: DEFAULT_BRANDING.company_name,
  companyTagline: DEFAULT_BRANDING.company_tagline,
  brandLogoUrl: DEFAULT_BRANDING.brand_logo_url || '',
  registrationMode: DEFAULT_BRANDING.registration_mode || 'approval',
  isLoading: false,
  refreshBranding: async () => {},
  updateBranding: async () => ({ success: false }),
  uploadBrandLogo: async () => ({ success: false }),
});

/** Normalise an API payload into the context shape (missing fields → defaults). */
function toBrandingInfo(data: Partial<BrandingInfo> | null | undefined): BrandingInfo {
  return {
    company_name: data?.company_name || DEFAULT_BRANDING.company_name,
    company_tagline: data?.company_tagline ?? DEFAULT_BRANDING.company_tagline,
    brand_logo_url: data?.brand_logo_url || '',
    registration_mode: data?.registration_mode || 'approval',
  };
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingInfo>(() => {
    if (typeof window === 'undefined') return DEFAULT_BRANDING;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return toBrandingInfo(JSON.parse(cached));
    } catch {
      // Fallback
    }
    return DEFAULT_BRANDING;
  });

  const [isLoading, setIsLoading] = useState(false);

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

  /** Keep state + cache in sync with a branding payload from the API. */
  const applyBranding = useCallback((next: BrandingInfo) => {
    setBranding(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/system/branding`);
      if (res.ok) {
        applyBranding(toBrandingInfo(await res.json()));
      }
    } catch {
      // ignore network errors, keep cached/default
    }
  }, [apiBaseUrl, applyBranding]);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  const uploadBrandLogo = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetchWithAuth('/api/v1/system/branding/logo', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.detail || data?.message || 'ไม่สามารถอัปโหลดโลโก้ได้';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
        }
        applyBranding(toBrandingInfo(data));
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [applyBranding],
  );

  const updateBranding = useCallback(
    async (newValues: Partial<BrandingInfo>): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        // Only send what this call is about: the API keeps the stored logo when
        // the field is absent, so saving the name no longer re-uploads a
        // 20–40KB data URL (or risks clearing it).
        const payload: Record<string, string> = {
          company_name: newValues.company_name ?? branding.company_name,
          company_tagline: newValues.company_tagline ?? branding.company_tagline,
          registration_mode:
            newValues.registration_mode ?? branding.registration_mode ?? 'approval',
        };
        if (newValues.brand_logo_url !== undefined) {
          payload.brand_logo_url = newValues.brand_logo_url;
        }

        const res = await fetchWithAuth('/api/v1/system/branding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg =
            errData.detail || errData.message || 'ไม่สามารถบันทึกข้อมูลการตั้งค่าแบรนด์ได้';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
        }

        applyBranding(toBrandingInfo(await res.json()));
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [applyBranding, branding.company_name, branding.company_tagline, branding.registration_mode],
  );

  // A stable value keeps every consumer (sidebar, login, register, profile)
  // from re-rendering whenever something above them re-renders.
  const value = useMemo<BrandingContextValue>(
    () => ({
      companyName: branding.company_name,
      companyTagline: branding.company_tagline,
      brandLogoUrl: branding.brand_logo_url || '',
      registrationMode: branding.registration_mode || 'approval',
      isLoading,
      refreshBranding,
      updateBranding,
      uploadBrandLogo,
    }),
    [branding, isLoading, refreshBranding, updateBranding, uploadBrandLogo],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
