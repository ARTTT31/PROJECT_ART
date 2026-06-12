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
        // Step 1: Check URL Parameters first (Google Login callback)
        const urlParams = new URLSearchParams(window.location.search);
        const urlAccessToken = urlParams.get('token') || urlParams.get('access_token');
        const urlRefreshToken = urlParams.get('refresh_token');
        const urlUserStr = urlParams.get('user');
        
        let user = null;
        if (urlUserStr) {
          try {
            user = JSON.parse(decodeURIComponent(urlUserStr));
          } catch {
            // failed to parse user from url
          }
        }

        if (urlAccessToken && user) {
          hasRedirected.current = true;
          
          localStorage.setItem('access_token', urlAccessToken);
          if (urlRefreshToken) localStorage.setItem('refresh_token', urlRefreshToken);
          localStorage.setItem('user', JSON.stringify(user));

          login(urlAccessToken, user);

          window.history.replaceState({}, '', '/login-success');
          router.push('/dashboard');
          return;
        }

        // Step 2: Try reading user data from non-httpOnly cookie (fast)
        const userCookie = document.cookie
          .split('; ')
          .find((c) => c.startsWith('user='));
        
        if (!user && userCookie) {
          try {
            user = JSON.parse(decodeURIComponent(userCookie.split('=').slice(1).join('=')));
          } catch {
            // cookie parse failed, fall through to session endpoint
          }
        }

        // Step 3: Call session endpoint to get access_token from HTTP-only cookies
        const res = await fetch('/api/v1/auth/session', {
          credentials: 'include', // Send cookies
        });

        if (!res.ok) {
          console.log('No valid session found, redirecting to login');
          hasRedirected.current = true;
          router.push('/login');
          return;
        }

        const json = await res.json();
        const { access_token, refresh_token, user: sessionUser } = json.data || {};

        if (access_token && (sessionUser || user)) {
          hasRedirected.current = true;
          const userData = sessionUser || user;

          // Store tokens in localStorage for the auth context
          localStorage.setItem('access_token', access_token);
          if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
          localStorage.setItem('user', JSON.stringify(userData));

          // Trigger auth context login
          login(access_token, userData);

          // Clean up URL (remove any residual params)
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