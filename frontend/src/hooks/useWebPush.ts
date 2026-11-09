'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { showToast } from '@/utils/sweetalert';

export interface UseWebPushReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  isTesting: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as unknown as BufferSource;
}

export function useWebPush(): UseWebPushReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported =
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission);

    let isMounted = true;
    async function checkSubscription() {
      try {
        const res = await fetchWithAuth('/api/v1/profile/web-push');
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsSubscribed(Boolean(data.has_subscription));
        }
      } catch (err) {
        console.error('Failed to check web push subscription status:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkSubscription();
    return () => {
      isMounted = false;
    };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      showToast('เบราว์เซอร์นี้ไม่รองรับ Web Push Notification', 'warning');
      return false;
    }

    try {
      setIsLoading(true);
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        showToast('คุณยังไม่ได้อนุญาตการแจ้งเตือนจากเบราว์เซอร์', 'warning');
        return false;
      }

      // A subscription needs the server's VAPID public key. Without it there is
      // nothing to register with the push service, and reporting success anyway
      // left users with a "subscribed" switch that could never deliver.
      const vapidRes = await fetchWithAuth('/api/v1/profile/web-push/vapid-key');
      if (!vapidRes.ok) {
        throw new Error('ไม่สามารถรับกุญแจสำหรับการแจ้งเตือนได้ กรุณาลองใหม่');
      }
      const vapidData = (await vapidRes.json()) as { public_key?: string };
      if (!vapidData.public_key) {
        throw new Error('เซิร์ฟเวอร์ยังไม่พร้อมสำหรับการแจ้งเตือน');
      }
      const applicationServerKey = urlBase64ToUint8Array(vapidData.public_key);

      const reg = await navigator.serviceWorker.ready;
      if (!reg.pushManager) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับ Web Push Notification');
      }

      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await sub.unsubscribe();
          sub = null;
        } catch (unsubErr) {
          console.warn('Could not reset stale push subscription:', unsubErr);
        }
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const endpoint = sub.endpoint;
      const p256dh = sub.getKey('p256dh')
        ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sub.getKey('p256dh')!))))
        : '';
      const auth = sub.getKey('auth')
        ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sub.getKey('auth')!))))
        : '';

      const res = await fetchWithAuth('/api/v1/profile/web-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
        }),
      });

      if (!res.ok) {
        throw new Error('ไม่สามารถบันทึกการสมัครรับแจ้งเตือนได้');
      }

      setIsSubscribed(true);
      showToast('เปิดรับการแจ้งเตือนบนเบราว์เซอร์สำเร็จ', 'success');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปิดแจ้งเตือน';
      showToast(msg, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager?.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        } catch {
          // Ignore error on client unsub
        }
      }

      const res = await fetchWithAuth('/api/v1/profile/web-push', {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('ไม่สามารถยกเลิกการแจ้งเตือนได้');
      }

      setIsSubscribed(false);
      showToast('ยกเลิกการรับแจ้งเตือนบนเบราว์เซอร์แล้ว', 'info');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิก';
      showToast(msg, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      showToast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', 'warning');
      return false;
    }

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showToast('กรุณาอนุญาตการแจ้งเตือนจากเบราว์เซอร์ก่อนทดสอบ', 'warning');
        return false;
      }
    }

    try {
      setIsTesting(true);
      const res = await fetchWithAuth('/api/v1/profile/web-push/test', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('ส่งการแจ้งเตือนทดสอบไม่สำเร็จ');
      }

      const resData = await res.json();
      const notif = resData.notification || {
        title: 'ART Workspace',
        body: 'ทดสอบการแจ้งเตือนสำเร็จ!',
        url: '/dashboard',
      };

      // If the backend sent real push via FCM/APNs, the SW will handle it.
      // If not sent via push service (e.g. simulated or offline), trigger local fallback:
      if (!resData.sent_via_push_service) {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(notif.title, {
            body: notif.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: { url: notif.url },
          });
        } else {
          new Notification(notif.title, {
            body: notif.body,
            icon: '/icons/icon-192x192.png',
          });
        }
      }

      showToast('ส่งการแจ้งเตือนทดสอบเรียบร้อยแล้ว', 'success');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถแสดงการแจ้งเตือนได้';
      showToast(msg, 'error');
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isTesting,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
