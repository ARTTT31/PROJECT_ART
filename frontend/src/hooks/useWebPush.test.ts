import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebPush } from './useWebPush';
import * as sweetalert from '@/utils/sweetalert';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';

vi.mock('@/utils/sweetalert', () => ({
  showToast: vi.fn(),
}));

describe('useWebPush', () => {
  const originalNotification = window.Notification;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.Notification = originalNotification;
  });

  it('handles unsupported environment gracefully', () => {
    // Force unsupported
    // @ts-expect-error mocking Notification
    delete window.Notification;

    const { result } = renderHook(() => useWebPush());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.permission).toBe('unsupported');
  });

  it('initializes and checks subscription when supported', async () => {
    // Mock Notification
    window.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as typeof Notification;

    // Mock PushManager
    (window as unknown as { PushManager: unknown }).PushManager = {};

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
      },
      configurable: true,
    });

    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ has_subscription: true }),
    } as unknown as Response);

    const { result } = renderHook(() => useWebPush());

    expect(result.current.isSupported).toBe(true);

    // Wait for async fetch to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  it('subscribes successfully when permission is granted', async () => {
    window.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as typeof Notification;
    (window as unknown as { PushManager: unknown }).PushManager = {};

    const mockSub = {
      endpoint: 'https://example.com/push/123',
      getKey: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]).buffer),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(mockSub),
          },
        }),
      },
      configurable: true,
    });

    const fetchSpy = vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockImplementation((url) => {
      if (url.toString().includes('vapid-key')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            result: 'success',
            public_key: 'BFakeVapidPublicKeyForTest1234567890',
          }),
        } as unknown as Response);
      }
      if (url.toString().includes('test')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            result: 'success',
            notification: { title: 'Test Title', body: 'Test Body', url: '/dashboard' },
          }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({ result: 'success' }),
      } as unknown as Response);
    });

    const { result } = renderHook(() => useWebPush());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(true);
    expect(result.current.isSubscribed).toBe(true);
    expect(sweetalert.showToast).toHaveBeenCalledWith('เปิดรับการแจ้งเตือนบนเบราว์เซอร์สำเร็จ', 'success');

    // Unsubscribe flow
    let unsubSuccess = false;
    await act(async () => {
      unsubSuccess = await result.current.unsubscribe();
    });

    expect(unsubSuccess).toBe(true);
    expect(result.current.isSubscribed).toBe(false);
  });

  it('requests VAPID public key and subscribes via PushManager when no active subscription exists', async () => {
    window.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as typeof Notification;
    (window as unknown as { PushManager: unknown }).PushManager = {};

    const mockCreatedSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/new-token',
      getKey: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6]).buffer),
    };

    const subscribeMock = vi.fn().mockResolvedValue(mockCreatedSub);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: subscribeMock,
          },
        }),
      },
      configurable: true,
    });

    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockImplementation((url) => {
      if (url.toString().includes('vapid-key')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            result: 'success',
            public_key: 'BFakeVapidPublicKeyForTest1234567890',
          }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({ result: 'success' }),
      } as unknown as Response);
    });

    const { result } = renderHook(() => useWebPush());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(true);
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
      })
    );
  });

  it('does not store a fake subscription when the VAPID key is unavailable', async () => {
    window.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as typeof Notification;
    (window as unknown as { PushManager: unknown }).PushManager = {};

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
      configurable: true,
    });

    const fetchSpy = vi
      .spyOn(fetchWithAuthModule, 'fetchWithAuth')
      .mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response);

    const { result } = renderHook(() => useWebPush());

    let success = true;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
    // No POST /web-push with a placeholder endpoint.
    expect(
      fetchSpy.mock.calls.some(([url, init]) => url.toString().endsWith('/web-push') && init?.method === 'POST')
    ).toBe(false);
  });
});
