import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall, type BeforeInstallPromptEvent } from './usePwaInstall';

describe('usePwaInstall', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default non-installed state', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canPromptDirectly).toBe(false);
  });

  it('captures beforeinstallprompt event and becomes installable', () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPromptEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    // Attach mock properties
    Object.defineProperty(mockPromptEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockPromptEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(mockPromptEvent);
    });

    expect(result.current.canPromptDirectly).toBe(true);
    expect(result.current.isInstallable).toBe(true);
  });

  it('dismisses banner and persists to sessionStorage', () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPromptEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperty(mockPromptEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockPromptEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(mockPromptEvent);
    });

    expect(result.current.isInstallable).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isInstallable).toBe(false);
    expect(sessionStorage.getItem('art_pwa_install_dismissed')).toBe('1');
  });

  it('marks as installed on appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });
});
