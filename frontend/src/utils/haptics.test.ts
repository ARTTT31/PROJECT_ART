import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHaptic, hapticTap, hapticSuccess, hapticWarning, useHaptics } from './haptics';

describe('haptics utility', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('safely returns false when navigator.vibrate is not available', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });

    expect(triggerHaptic(10)).toBe(false);
    expect(hapticTap()).toBe(false);
    expect(hapticSuccess()).toBe(false);
    expect(hapticWarning()).toBe(false);
  });

  it('calls navigator.vibrate with correct patterns when available', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: mockVibrate,
      },
      configurable: true,
      writable: true,
    });

    expect(hapticTap()).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith(10);

    expect(hapticSuccess()).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith([12, 40, 12]);

    expect(hapticWarning()).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith([30, 50, 30]);
  });

  it('returns false if navigator.vibrate throws an error', () => {
    const mockVibrate = vi.fn().mockImplementation(() => {
      throw new Error('Not allowed');
    });
    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: mockVibrate,
      },
      configurable: true,
      writable: true,
    });

    expect(triggerHaptic(10)).toBe(false);
  });

  it('useHaptics hook exposes tap, success, warning', () => {
    const hook = useHaptics();
    expect(typeof hook.tap).toBe('function');
    expect(typeof hook.success).toBe('function');
    expect(typeof hook.warning).toBe('function');
  });
});
