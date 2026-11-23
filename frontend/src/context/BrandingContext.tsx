'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { getApiBaseUrl } from '@/lib/api/apiBase';

export interface BrandingInfo {
  company_name: string;
  company_tagline: string;
  brand_logo_url?: string;
  registration_mode?: string;
}

/** What one account personalised; empty means "use the workspace value". */
export interface WorkspaceBrandingInfo {
  name: string;
  tagline: string;
  logo: string;
}

interface BrandingContextValue {
  /** Effective values for this account: personal override, else workspace. */
  companyName: string;
  companyTagline: string;
  brandLogoUrl: string;
  registrationMode: string;
  /** The raw personal overrides (empty when the account uses the defaults). */
  workspaceName: string;
  workspaceTagline: string;
  workspaceLogo: string;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (
    branding: Partial<BrandingInfo>,
  ) => Promise<{ success: boolean; error?: string }>;
  uploadBrandLogo: (file: File) => Promise<{ success: boolean; error?: string }>;
  updateWorkspaceBranding: (
    branding: Partial<{
      workspace_name: string;
      workspace_tagline: string;
      workspace_logo: string;
    }>,
  ) => Promise<{ success: boolean; error?: string }>;
  uploadWorkspaceLogo: (file: File) => Promise<{ success: boolean; error?: string }>;
}

// Neutral until someone names their workspace: every account can rename it in
// โปรไฟล์ › พื้นที่ทำงาน, and an admin can set it for everyone.
const DEFAULT_BRANDING: BrandingInfo = {
  company_name: 'Workspace',
  company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
  brand_logo_url: '',
  registration_mode: 'approval',
};

const EMPTY_PERSONAL: WorkspaceBrandingInfo = { name: '', tagline: '', logo: '' };

const STORAGE_KEY = 'workspace_branding';
// Keys used while the product still had a fixed brand name. A cached value
// under them would keep painting the retired name on every load, so they are
// dropped instead of migrated: a rename has to win over an old cache.
const LEGACY_STORAGE_KEYS = ['art_workspace_branding', 'art_workspace_branding_at'];

const BrandingContext = createContext<BrandingContextValue>({
  companyName: DEFAULT_BRANDING.company_name,
  companyTagline: DEFAULT_BRANDING.company_tagline,
  brandLogoUrl: DEFAULT_BRANDING.brand_logo_url || '',
  registrationMode: DEFAULT_BRANDING.registration_mode || 'approval',
  workspaceName: '',
  workspaceTagline: '',
  workspaceLogo: '',
  isLoading: false,
  refreshBranding: async () => {},
  updateBranding: async () => ({ success: false }),
  uploadBrandLogo: async () => ({ success: false }),
  updateWorkspaceBranding: async () => ({ success: false }),
  uploadWorkspaceLogo: async () => ({ success: false }),
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

function toWorkspaceBranding(data: unknown): WorkspaceBrandingInfo {
  const payload = (data ?? {}) as {
    workspace_name?: string;
    workspace_tagline?: string;
    workspace_logo?: string;
  };
  return {
    name: payload.workspace_name || '',
    tagline: payload.workspace_tagline || '',
    logo: payload.workspace_logo || '',
  };
}

export function BrandingProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  /**
   * What the server already rendered, read from the API by the root layout.
   * Without it the prerendered name was the neutral default while the browser's
   * first render used the cached one, and the sidebar's name and tagline
   * disagreed with the HTML — React error #418 (hydration) on every signed-in
   * page. The cache is now only a post-mount fallback.
   */
  initialBranding?: BrandingInfo;
}) {
  const [branding, setBranding] = useState<BrandingInfo>(() =>
    toBrandingInfo(initialBranding),
  );
  const apiApplied = useRef(false);

  const [personal, setPersonal] = useState<WorkspaceBrandingInfo>(EMPTY_PERSONAL);
  const [isLoading, setIsLoading] = useState(false);

  const apiBaseUrl = getApiBaseUrl();

  /** Keep state + cache in sync with a branding payload from the API. */
  const applyBranding = useCallback((next: BrandingInfo) => {
    apiApplied.current = true;
    setBranding(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  // A stored copy still covers the case where the server could not reach the
  // API, but it must never be the first render: that is what broke hydration.
  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached || apiApplied.current) return;
      const parsed = toBrandingInfo(JSON.parse(cached));
      setBranding((current) =>
        current.company_name === DEFAULT_BRANDING.company_name &&
        current.company_tagline === DEFAULT_BRANDING.company_tagline
          ? parsed
          : current,
      );
    } catch {
      // A cache that cannot be read is not worth a failed paint.
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

  // The cached value paints the first frame, but it is only ever a cache: a
  // rename has to reach every account on its next visit, so the backend is
  // asked on every load instead of after a five-minute TTL.
  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  /**
   * The signed-in account's own overrides. They live on the user row, so a
   * 401 (signed out) simply clears them and the workspace values show through.
   */
  const refreshWorkspaceBranding = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/profile/workspace-branding');
      if (res.status === 401) {
        setPersonal(EMPTY_PERSONAL);
        return;
      }
      if (!res.ok) return;
      setPersonal(toWorkspaceBranding(await res.json()));
    } catch {
      // keep whatever we already show
    }
  }, []);

  useEffect(() => {
    // The login/register pages have no session yet. Calling the authenticated
    // endpoint there only produced a 401 in the console and an extra backend
    // round-trip on every visit; wait for an actual local session instead.
    const hasLocalSession = () => {
      if (typeof window === 'undefined') return false;
      return (
        localStorage.getItem('user') !== null ||
        document.cookie.split('; ').some((cookie) => cookie.startsWith('user='))
      );
    };

    if (hasLocalSession()) void refreshWorkspaceBranding();

    const handleAuthChange = () => {
      if (hasLocalSession()) void refreshWorkspaceBranding();
      else setPersonal(EMPTY_PERSONAL);
    };
    window.addEventListener('auth-login', handleAuthChange);
    window.addEventListener('auth-logout', handleAuthChange);
    return () => {
      window.removeEventListener('auth-login', handleAuthChange);
      window.removeEventListener('auth-logout', handleAuthChange);
    };
  }, [refreshWorkspaceBranding]);

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

  const updateWorkspaceBranding = useCallback(
    async (
      values: Partial<{
        workspace_name: string;
        workspace_tagline: string;
        workspace_logo: string;
      }>,
    ): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth('/api/v1/profile/workspace-branding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.detail || data?.message || 'ไม่สามารถบันทึกข้อมูลของคุณได้';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
        }
        setPersonal(toWorkspaceBranding(data));
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const uploadWorkspaceLogo = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetchWithAuth('/api/v1/profile/workspace-branding/logo', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.detail || data?.message || 'ไม่สามารถอัปโหลดโลโก้ได้';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
        }
        setPersonal(toWorkspaceBranding(data));
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // A stable value keeps every consumer (sidebar, login, register, profile)
  // from re-rendering whenever something above them re-renders.
  const value = useMemo<BrandingContextValue>(
    () => ({
      companyName: personal.name || branding.company_name,
      companyTagline: personal.tagline || branding.company_tagline,
      brandLogoUrl: personal.logo || branding.brand_logo_url || '',
      registrationMode: branding.registration_mode || 'approval',
      workspaceName: personal.name,
      workspaceTagline: personal.tagline,
      workspaceLogo: personal.logo,
      isLoading,
      refreshBranding,
      updateBranding,
      uploadBrandLogo,
      updateWorkspaceBranding,
      uploadWorkspaceLogo,
    }),
    [
      personal,
      branding,
      isLoading,
      refreshBranding,
      updateBranding,
      uploadBrandLogo,
      updateWorkspaceBranding,
      uploadWorkspaceLogo,
    ],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
