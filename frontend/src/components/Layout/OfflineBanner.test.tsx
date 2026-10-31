import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    expect(screen.getByText(/คุณกำลังทำงานในโหมดออฟไลน์/i)).toBeInTheDocument();
  });

  it('switches to reconnected status when online event fires', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);

    expect(screen.getByText(/คุณกำลังทำงานในโหมดออฟไลน์/i)).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText(/เชื่อมต่ออินเทอร์เน็ตสำเร็จแล้ว/i)).toBeInTheDocument();

    // Auto dismiss after timeout
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
