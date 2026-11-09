import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PullToRefresh from './PullToRefresh';

describe('PullToRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('renders children correctly', () => {
    render(
      <PullToRefresh>
        <div>Content Inside</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Content Inside')).toBeInTheDocument();
    expect(screen.queryByTestId('pull-to-refresh-indicator')).not.toBeInTheDocument();
  });

  it('shows indicator on touchmove when at top of page', () => {
    render(
      <PullToRefresh>
        <div>Content Inside</div>
      </PullToRefresh>
    );

    act(() => {
      fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(window, { touches: [{ clientY: 200 }] });
    });

    expect(screen.getByTestId('pull-to-refresh-indicator')).toBeInTheDocument();
    expect(screen.getByText(/รีเฟรช/)).toBeInTheDocument();
  });

  it('triggers onRefresh when pulled beyond threshold and released', async () => {
    const onRefreshMock = vi.fn().mockResolvedValue(undefined);

    render(
      <PullToRefresh onRefresh={onRefreshMock}>
        <div>Content Inside</div>
      </PullToRefresh>
    );

    await act(async () => {
      fireEvent.touchStart(window, { touches: [{ clientY: 50 }] });
      fireEvent.touchMove(window, { touches: [{ clientY: 250 }] });
      fireEvent.touchEnd(window);
    });

    expect(onRefreshMock).toHaveBeenCalledTimes(1);
  });
});
