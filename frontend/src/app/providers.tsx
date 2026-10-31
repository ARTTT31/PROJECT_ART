'use client';

import { AuthProvider } from '@/components/Auth/AuthProvider';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { BrandingProvider } from '@/context/BrandingContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrandingFavicon } from '@/components/Branding/BrandingFavicon';
import ErrorBoundary from '@/components/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrandingProvider>
          <BrandingFavicon />
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </BrandingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
