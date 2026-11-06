import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommandPalette, { openCommandPalette } from './CommandPalette';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin' } }),
}));

vi.mock('@/lib/offline/localStore', () => ({
  readCached: vi.fn().mockImplementation((key: string) => {
    if (key === 'profile/quick-links') {
      return { data: [{ id: 'link-1', title: 'Salesforce', url: 'https://salesforce.com' }] };
    }
    return null;
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens when openCommandPalette is triggered', async () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText('ค้นหาหน้า โน้ต รายการติดตาม เตือนของฉัน หรือผู้ใช้…')).toBeNull();

    await act(async () => {
      openCommandPalette();
    });

    expect(screen.getByPlaceholderText('ค้นหาหน้า โน้ต รายการติดตาม เตือนของฉัน หรือผู้ใช้…')).toBeDefined();
  });

  it('searches and finds quick actions and quick links', async () => {
    render(<CommandPalette />);
    await act(async () => {
      openCommandPalette();
    });

    const input = screen.getByPlaceholderText('ค้นหาหน้า โน้ต รายการติดตาม เตือนของฉัน หรือผู้ใช้…');

    // Search for focus timer action
    fireEvent.change(input, { target: { value: 'โฟกัส' } });
    expect(screen.getByText('เริ่มโฟกัส & จับเวลา (Focus Timer)')).toBeDefined();

    // Search for quick links
    fireEvent.change(input, { target: { value: 'Salesforce' } });
    expect(screen.getByText('Salesforce')).toBeDefined();
  });

  it('navigates when an action is clicked', async () => {
    render(<CommandPalette />);
    await act(async () => {
      openCommandPalette();
    });

    const item = screen.getByText('เริ่มโฟกัส & จับเวลา (Focus Timer)');
    fireEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
