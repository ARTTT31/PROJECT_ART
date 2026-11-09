'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import AICopilotDrawer from '@/components/AICopilot/AICopilotDrawer';
import { PwaInstallPrompt } from '@/components/PWA/PwaInstallPrompt';
import { showConfirm } from '@/utils/sweetalert';
import AuthGuard from '@/components/Auth/AuthGuard';
import AuthTransitionOverlay from '@/components/Auth/AuthTransitionOverlay';
import { useAuth } from '@/hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/** Display preference, not workspace data — same idea as the theme card. */
const SIDEBAR_COLLAPSED_KEY = 'art_sidebar_collapsed';

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    router.prefetch('/dashboard');
    router.prefetch('/profile');
  }, [router]);

  // The collapsed rail is a display preference like the theme, so it survives
  // a reload. Read after mount to keep the server and client markup identical.
  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') setSidebarCollapsed(true);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Private mode: the choice just does not persist.
      }
      return next;
    });
  };

  // The mobile drawer is a modal surface: Escape must close it, background
  // scrolling is locked on mobile, and focus starts inside the drawer.
  useEffect(() => {
    if (!sidebarOpen) return;
    const originalOverflow = document.body.style.overflow;
    if (window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('#app-sidebar nav a, #app-sidebar nav button')
        ?.focus();
    }, 60);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [sidebarOpen]);

  // Close mobile drawer when navigating or when resized to desktop
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    const result = await showConfirm('ต้องการออกจากระบบหรือไม่?', 'กดยืนยันเพื่อออกจากระบบ');
    if (!result.isConfirmed) return;

    // Hold the overlay on screen for a beat before the session is cleared, so
    // signing out reads as a deliberate transition rather than a jump cut.
    setIsLoggingOut(true);
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    await logout();
    router.replace('/login');
  };

  return (
    <>
      <AuthGuard>
        <div className="art-app-shell relative overflow-x-hidden bg-[var(--surface-grouped)] min-h-[100dvh] text-[var(--ink)]">
          {/* Mobile Sidebar Backdrop Overlay — sits at z-30 to blur background behind the z-40 drawer */}
          {sidebarOpen && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="ปิดเมนู"
              className="fixed inset-0 z-30 bg-[var(--scrim)] backdrop-blur-xs transition-opacity duration-300 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar Drawer — sits at fixed z-40 so it stays above the z-30 backdrop */}
          <Sidebar
            isOpen={sidebarOpen}
            isCollapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            user={user}
            onLogout={handleLogout}
          />

          {/* Main Content wrapper */}
          <div
            className={`relative z-10 min-h-[100dvh] flex flex-col transition-[padding] duration-300 ease-out ${
              sidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'
            }`}
          >
            {/* Header */}
            <Header
              user={user}
              onMenuClick={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) {
                  toggleSidebarCollapsed();
                  return;
                }
                setSidebarOpen((open) => !open);
              }}
              sidebarCollapsed={sidebarCollapsed}
            />

            {/* Page Content */}
            {/* Page Content: Fluid responsive width that adapts cleanly across mobile, laptop, and desktop monitors */}
            <main className="min-h-[calc(100dvh-52px)] w-full flex-1 p-4 pb-16 sm:p-6 sm:pb-16 lg:px-8 xl:px-10 lg:pb-20">
              <div key={pathname} className="page-enter h-full">
                {children}
              </div>
            </main>
          </div>

          <CommandPalette />
          <AICopilotDrawer />
          <PwaInstallPrompt />
        </div>
      </AuthGuard>

      {/* Kept outside AuthGuard so it stays visible while the session clear
          unmounts the dashboard. */}
      {isLoggingOut && (
        <AuthTransitionOverlay title="กำลังออกจากระบบ…" subtitle="แล้วพบกันใหม่เร็ว ๆ นี้" />
      )}
    </>
  );
}
