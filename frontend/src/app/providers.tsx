'use client';

import { AuthProvider } from '@/components/Auth/AuthProvider';
import type { AuthUser } from '@/types';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { BrandingProvider } from '@/context/BrandingContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrandingFavicon } from '@/components/Branding/BrandingFavicon';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import OfflineBanner from '@/components/Layout/OfflineBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  /** Session seeded from the readable `user` cookie by the server layout. */
  initialUser?: AuthUser | null;
}) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrandingProvider>
          <I18nProvider>
            <BrandingFavicon />
            <OfflineBanner />
            <AuthProvider initialUser={initialUser}>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </BrandingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
