'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AuthTransitionOverlay from '@/components/Auth/AuthTransitionOverlay';
import { AuthUserSchema } from '@/lib/api/schemas';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import { readUserCookie } from '@/lib/api/userCookie';
import { useI18n } from '@/lib/i18n/I18nProvider';

export default function LoginSuccessPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { tr } = useI18n();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;

    /** Same-origin only: anything else falls back to the dashboard. */
    const goAfterLogin = () => {
      const stored = sessionStorage.getItem('post_login_redirect');
      sessionStorage.removeItem('post_login_redirect');
      const safe =
        stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : '/dashboard';
      router.replace(safe);
    };

    const processLogin = async () => {
      try {
        // Step 1: Read user data from the non-httpOnly cookie for speed (fast-path).
        // The backend percent-encodes the JSON so it survives document.cookie;
        // validate the shape because the cookie is client-readable.
        const parsedCookieUser = AuthUserSchema.safeParse(readUserCookie());
        const user = parsedCookieUser.success ? parsedCookieUser.data : null;

        // If user already exists in cookie, redirect immediately to improve LCP/FCP
        if (user) {
          hasRedirected.current = true;
          login(user);
          window.history.replaceState({}, '', '/login-success');
          goAfterLogin();
          return;
        }

        // Step 2: Fallback to verify and fetch session details from backend via HTTP-only cookies
        const API_URL = getApiBaseUrl();
        const res = await fetch(`${API_URL}/api/v1/auth/session`, {
          credentials: 'include', // Ensure cookies are sent
        });

        if (!res.ok) {
          console.warn('No valid session found, redirecting to login');
          hasRedirected.current = true;
          router.replace('/login');
          return;
        }

        const json = await res.json();
        const { user: sessionUser } = json.data || {};

        if (sessionUser) {
          hasRedirected.current = true;
          login(sessionUser);
          window.history.replaceState({}, '', '/login-success');
          goAfterLogin();
        } else {
          hasRedirected.current = true;
          router.replace('/login');
        }
      } catch (err) {
        console.error('Error processing login:', err);
        hasRedirected.current = true;
        router.replace('/login');
      }
    };

    processLogin();
  }, [login, router]);

  return (
    <AuthTransitionOverlay
      tone="success"
      title={tr('เข้าสู่ระบบสำเร็จ', 'Signed in')}
      subtitle={tr('กำลังพาคุณเข้าสู่แดชบอร์ด…', 'Taking you to your dashboard…')}
    />
  );
}
