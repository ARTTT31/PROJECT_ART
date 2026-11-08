import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AICopilotDrawer from './AICopilotDrawer';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('AICopilotDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders floating trigger button initially', () => {
    render(<AICopilotDrawer />);
    const trigger = screen.getByLabelText('เปิด AI Copilot');
    expect(trigger).toBeDefined();
    expect(screen.queryByLabelText('หน้าต่างสนทนา AI Copilot')).toBeNull();
  });

  it('opens chat drawer when floating button is clicked', () => {
    render(<AICopilotDrawer />);
    const trigger = screen.getByLabelText('เปิด AI Copilot');
    fireEvent.click(trigger);

    expect(screen.getByLabelText('หน้าต่างสนทนา AI Copilot')).toBeDefined();
    expect(screen.getByText('AI Copilot')).toBeDefined();
    expect(screen.getByText(/สวัสดีครับ! ผมคือ AI Copilot/)).toBeDefined();
    expect(screen.getByText('สรุปภาพรวมวันนี้')).toBeDefined();
  });

  it('sends a chat message and displays AI reply', async () => {
    (fetchWithAuth as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: 'success',
        reply: 'สภาพอากาศวันนี้ท้องฟ้าแจ่มใสครับ',
      }),
    });

    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));

    const input = screen.getByPlaceholderText(/สั่งงาน เช่น/);
    fireEvent.change(input, { target: { value: 'เช็คสภาพอากาศ' } });

    const sendBtn = screen.getByLabelText('ส่งข้อความ');
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/ai/chat', expect.objectContaining({
      method: 'POST',
    }));

    await waitFor(() => {
      expect(screen.getByText('สภาพอากาศวันนี้ท้องฟ้าแจ่มใสครับ')).toBeDefined();
    });
  });

  it('executes add_note action when returned from backend', async () => {
    (fetchWithAuth as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          reply: 'จดบันทึกให้เรียบร้อยแล้วครับ: "ซื้อกาแฟ" ✨',
          action: {
            type: 'add_note',
            data: { text: 'ซื้อกาแฟ' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));

    const input = screen.getByPlaceholderText(/สั่งงาน เช่น/);
    fireEvent.change(input, { target: { value: 'จดโน้ตว่า ซื้อกาแฟ' } });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('ส่งข้อความ'));
    });

    await waitFor(() => {
      expect(screen.getByText('เพิ่มลงใน Quick Notes แล้ว')).toBeDefined();
    });

    // Check localStorage fallback sync
    const raw = localStorage.getItem('quick_notes_tasks');
    expect(raw).toContain('ซื้อกาแฟ');
  });

  it('closes when close button is clicked', () => {
    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));
    expect(screen.getByLabelText('หน้าต่างสนทนา AI Copilot')).toBeDefined();

    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง AI Copilot');
    fireEvent.click(closeBtn);

    expect(screen.queryByLabelText('หน้าต่างสนทนา AI Copilot')).toBeNull();
  });
});
