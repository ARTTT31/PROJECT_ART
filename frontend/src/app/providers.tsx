'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/components/Auth/AuthProvider';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { BrandingProvider } from '@/context/BrandingContext';
import { BrandingFavicon } from '@/components/Branding/BrandingFavicon';
import ErrorBoundary from '@/components/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <BrandingFavicon />
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
