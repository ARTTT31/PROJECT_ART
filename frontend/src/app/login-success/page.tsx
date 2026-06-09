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

    try {
      // Try reading from URL first (query params)
      const params = new URLSearchParams(window.location.search);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const user_str = params.get('user');
      
      let user = null;
      if (user_str) {
        user = JSON.parse(decodeURIComponent(user_str));
      }

      console.log('Login success:', { 
        hasAccessToken: !!access_token, 
        hasRefreshToken: !!refresh_token,
        user: user?.name 
      });

      if (access_token && user) {
        hasRedirected.current = true;
        
        // Store tokens
        localStorage.setItem('access_token', access_token);
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Trigger auth context login
        login(access_token, user);
        
        console.log('Stored tokens, redirecting to dashboard');
        setTimeout(() => router.push('/dashboard'), 300);
      } else {
        console.log('Missing tokens or user, redirecting to login');
        hasRedirected.current = true;
        router.push('/login');
      }
    } catch (err) {
      console.error('Error processing login:', err);
      hasRedirected.current = true;
      router.push('/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบสำเร็จ</h2>
        <p className="mt-2 text-gray-700">กำลังพาคุณเข้าสู่ Dashboard...</p>
      </div>
    </div>
  );
}
