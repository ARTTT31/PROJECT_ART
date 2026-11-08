import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PwaInstallPrompt, PwaHeaderButton } from './PwaInstallPrompt';
import type { BeforeInstallPromptEvent } from '@/hooks/usePwaInstall';

describe('PwaInstallPrompt & PwaHeaderButton', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('does not render when not installable', () => {
    const { container } = render(<PwaInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders floating banner when beforeinstallprompt fires and calls prompt on click', async () => {
    render(<PwaInstallPrompt />);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockPromptEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperty(mockPromptEvent, 'prompt', { value: mockPrompt });
    Object.defineProperty(mockPromptEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(mockPromptEvent);
    });

    expect(screen.getByText('ติดตั้ง ART Workspace')).toBeDefined();
    expect(screen.getByText('เพิ่มลงหน้าจอหลักเพื่อเปิดใช้งานแบบเต็มจอ')).toBeDefined();

    const installBtn = screen.getByRole('button', { name: 'ติดตั้ง' });
    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(mockPrompt).toHaveBeenCalled();
  });

  it('renders header button and dismisses banner on close click', () => {
    render(
      <div>
        <PwaHeaderButton />
        <PwaInstallPrompt />
      </div>
    );

    const mockPromptEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperty(mockPromptEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockPromptEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(mockPromptEvent);
    });

    expect(screen.getByRole('button', { name: 'ติดตั้งแอป ART Workspace' })).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: 'ปิดคำแนะนำการติดตั้ง' });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText('เพิ่มลงหน้าจอหลักเพื่อเปิดใช้งานแบบเต็มจอ')).toBeNull();
  });
});
