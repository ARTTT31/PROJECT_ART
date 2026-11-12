'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

/** Register the browser's current push subscription with the server. */
async function registerWithServer(reg: ServiceWorkerRegistration): Promise<boolean> {
  const vapidRes = await fetchWithAuth('/api/v1/profile/web-push/vapid-key');
  if (!vapidRes.ok) return false;
  const vapidData = (await vapidRes.json()) as { public_key?: string };
  if (!vapidData.public_key) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.public_key),
    });
  }

  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  const toBase64 = (key: ArrayBuffer | null) =>
    key ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(key)))) : '';

  const res = await fetchWithAuth('/api/v1/profile/web-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: toBase64(p256dh), auth: toBase64(auth) },
    }),
  });
  return res.ok;
}

export function useWebPush(): UseWebPushReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  // The repair runs at most once per mount: a failed attempt must not turn into
  // a loop of subscribe/unsubscribe against the push service.
  const repairAttemptedRef = useRef(false);

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

    /**
     * Re-register a device the server no longer knows about.
     *
     * A subscription is pruned when the push service rejects it (403 after a
     * VAPID key rotation, 404/410 when the browser dropped it). The browser copy
     * still exists, so nothing in the UI looked wrong — the switch read "พร้อมส่ง"
     * while every morning briefing failed silently. Recreating the subscription
     * with the key the server uses now is the only way an old-key subscription
     * can start delivering again, and it needs no user gesture once permission is
     * already granted.
     */
    async function repairMissingSubscription() {
      if (repairAttemptedRef.current) return;
      if (Notification.permission !== 'granted') return;
      repairAttemptedRef.current = true;

      try {
        const reg = await navigator.serviceWorker.ready;
        const local = await reg.pushManager.getSubscription();
        // No local subscription means the user turned it off here on purpose.
        if (!local) return;

        try {
          await local.unsubscribe();
        } catch {
          // A subscription that cannot be dropped is still worth re-registering.
        }

        if (await registerWithServer(reg)) {
          if (isMounted) setIsSubscribed(true);
        }
      } catch {
        // Offline or blocked: the next visit tries again.
      }
    }

    async function checkSubscription() {
      try {
        const res = await fetchWithAuth('/api/v1/profile/web-push');
        if (res.ok && isMounted) {
          const data = await res.json();
          const serverKnowsThisDevice = Boolean(data.has_subscription);
          setIsSubscribed(serverKnowsThisDevice);
          if (!serverKnowsThisDevice) await repairMissingSubscription();
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

      const reg = await navigator.serviceWorker.ready;
      if (!reg.pushManager) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับ Web Push Notification');
      }

      // Start from a clean subscription: an existing one may be bound to an older
      // VAPID key, which the push service rejects.
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch (unsubErr) {
          console.warn('Could not reset stale push subscription:', unsubErr);
        }
      }

      if (!(await registerWithServer(reg))) {
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
