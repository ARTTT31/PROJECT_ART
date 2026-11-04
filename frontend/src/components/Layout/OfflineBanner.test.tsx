import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';
import { OFFLINE_CHANGE_EVENT } from '@/lib/offline/localStore';

const PENDING_KEY = 'artOffline:v1:local:pending:profile/quick-notes';

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not render when online initially', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders offline warning when offline initially', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/ออฟไลน์ · ข้อมูลล่าสุดถูกเก็บไว้ในเครื่อง/i)).toBeInTheDocument();
  });

  it('counts queued writes while offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ data: {}, updatedAt: 1 }));
    render(<OfflineBanner />);
    expect(screen.getByText(/มี 1 รายการรอซิงก์/i)).toBeInTheDocument();
  });

  it('hides after reconnecting when nothing was queued', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reports the queued count when the connection returns', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ data: {}, updatedAt: 1 }));
    render(<OfflineBanner />);

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText(/กำลังซิงก์ 1 รายการที่ค้างไว้/i)).toBeInTheDocument();

    // The widget flushed its queue: the banner confirms and then clears.
    window.localStorage.removeItem(PENDING_KEY);
    await act(async () => {
      window.dispatchEvent(new Event(OFFLINE_CHANGE_EVENT));
    });
    expect(screen.getByText(/ซิงก์ข้อมูลที่ค้างไว้ครบแล้ว/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
