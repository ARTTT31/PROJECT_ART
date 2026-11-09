import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAppBadge, clearAppBadge } from './appBadge';

describe('appBadge utility', () => {
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

  it('safely returns false when navigator does not support Badging API', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });

    const setResult = await setAppBadge(5);
    const clearResult = await clearAppBadge();

    expect(setResult).toBe(false);
    expect(clearResult).toBe(false);
  });

  it('calls navigator.setAppBadge with count when supported', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockClear = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global, 'navigator', {
      value: {
        setAppBadge: mockSet,
        clearAppBadge: mockClear,
      },
      configurable: true,
      writable: true,
    });

    const result = await setAppBadge(3);
    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(3);
  });

  it('calls clearAppBadge when count is 0 or negative', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockClear = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global, 'navigator', {
      value: {
        setAppBadge: mockSet,
        clearAppBadge: mockClear,
      },
      configurable: true,
      writable: true,
    });

    const result = await setAppBadge(0);
    expect(result).toBe(true);
    expect(mockClear).toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('calls navigator.clearAppBadge correctly', async () => {
    const mockClear = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global, 'navigator', {
      value: {
        clearAppBadge: mockClear,
      },
      configurable: true,
      writable: true,
    });

    const result = await clearAppBadge();
    expect(result).toBe(true);
    expect(mockClear).toHaveBeenCalled();
  });
});
