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
        // Step 1: Read user data from non-httpOnly cookie for speed (fast-path)
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

        // If user already exists in cookie, redirect immediately to improve LCP/FCP
        if (user) {
          hasRedirected.current = true;
          login(user);
          window.history.replaceState({}, '', '/login-success');
          router.replace('/dashboard');
          return;
        }

        // Step 2: Fallback to verify and fetch session details from backend via HTTP-only cookies
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://art-workspace-api.onrender.com';
        const res = await fetch(`${API_URL}/api/v1/auth/session`, {
          credentials: 'include', // Ensure cookies are sent
        });

        if (!res.ok) {
          console.log('No valid session found, redirecting to login');
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
          router.replace('/dashboard');
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
        <h2 className="text-[17px] font-bold text-[#1d1d1f]">เข้าสู่ระบบสำเร็จ</h2>
        <p className="mt-1 text-sm text-[#6e6e73]">กำลังพาคุณเข้าสู่ Dashboard...</p>
      </div>
    </div>
  );
}

