import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShareTargetClient from './ShareTargetClient';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ShareTargetClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial title and url in text area', () => {
    render(
      <ShareTargetClient
        initialTitle="Test Title"
        initialUrl="https://example.com"
      />
    );

    expect(screen.getByText('แชร์ข้อมูลเข้า Workspace')).toBeInTheDocument();
    const textarea = screen.getByLabelText('ข้อความที่จะบันทึก') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Test Title');
    expect(textarea.value).toContain('https://example.com');
  });

  it('saves note to API and redirects to dashboard on submit', async () => {
    const fetchSpy = vi.spyOn(fetchWithAuthModule, 'fetchWithAuth')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

    render(
      <ShareTargetClient
        initialTitle="Important Link"
        initialUrl="https://news.ycombinator.com"
      />
    );

    const saveButton = screen.getByRole('button', { name: /บันทึกลงโน้ตด่วน/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/profile/quick-notes', expect.objectContaining({
        method: 'PUT',
      }));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('cancels and navigates to /dashboard when cancel button is clicked', () => {
    render(<ShareTargetClient />);
    const cancelButton = screen.getByRole('button', { name: /ยกเลิก/i });
    fireEvent.click(cancelButton);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
