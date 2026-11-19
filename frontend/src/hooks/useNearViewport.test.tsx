import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNearViewport } from './useNearViewport';

function Probe({ rootMargin }: { rootMargin?: string }) {
  const { ref, isNear } = useNearViewport<HTMLDivElement>(rootMargin);
  return <div ref={ref} data-testid="probe" data-near={String(isNear)} />;
}

const originalObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalObserver;
  vi.restoreAllMocks();
});

describe('useNearViewport', () => {
  it('mounts immediately when IntersectionObserver is unavailable', () => {
    // @ts-expect-error -- deliberately simulating a browser without observer support.
    delete globalThis.IntersectionObserver;

    const { getByTestId } = render(<Probe />);

    expect(getByTestId('probe').dataset.near).toBe('true');
  });

  it('stays deferred until the card intersects, then disconnects', () => {
    let trigger: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();

    class FakeObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void, options?: { rootMargin?: string }) {
        trigger = callback;
        expect(options?.rootMargin).toBe('200px');
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [];
    }
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;

    const { getByTestId } = render(<Probe rootMargin="200px" />);
    const probe = getByTestId('probe');

    expect(observe).toHaveBeenCalledWith(probe);
    expect(probe.dataset.near).toBe('false');

    act(() => trigger?.([{ isIntersecting: false }]));
    expect(probe.dataset.near).toBe('false');

    act(() => trigger?.([{ isIntersecting: true }]));
    expect(probe.dataset.near).toBe('true');
    expect(disconnect).toHaveBeenCalled();
  });
});
