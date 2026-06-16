'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function LoginSuccessPage() {
  const router = useRouter();
  const { login } = useAuth();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;

    const processLogin = async () => {
      try {
        // Step 1: Read user data from non-httpOnly cookie for speed (optional)
        let user = null;
        const userCookie = document.cookie
          .split('; ')
          .find((c) => c.startsWith('user='));
        
        if (userCookie) {
          try {
            user = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
          } catch {
            // ignore parse error
          }
        }

        // Step 2: Verify and fetch session details from backend via HTTP-only cookies
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://art-workspace-api.onrender.com';
        const res = await fetch(`${API_URL}/api/v1/auth/session`, {
          credentials: 'include', // Ensure cookies are sent
        });

        if (!res.ok) {
          console.log('No valid session found, redirecting to login');
          hasRedirected.current = true;
          router.push('/login');
          return;
        }

        const json = await res.json();
        const { user: sessionUser } = json.data || {};

        if (sessionUser || user) {
          hasRedirected.current = true;
          const userData = sessionUser || user;

          // Trigger auth context login (token is null since it's cookie-managed)
          login(null, userData);

          // Clean up URL parameters
          window.history.replaceState({}, '', '/login-success');
          router.push('/dashboard');
        } else {
          hasRedirected.current = true;
          router.push('/login');
        }
      } catch (err) {
        console.error('Error processing login:', err);
        hasRedirected.current = true;
        router.push('/login');
      }
    };

    processLogin();
  }, [login, router]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบสำเร็จ</h2>
        <p className="mt-2 text-slate-600">กำลังพาคุณเข้าสู่ Dashboard...</p>
      </div>
    </div>
  );
}