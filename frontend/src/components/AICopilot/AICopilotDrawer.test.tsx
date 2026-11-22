import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AICopilotDrawer from './AICopilotDrawer';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { scopedStorageKey } from '@/lib/offline/localStore';

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('AICopilotDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    // The drawer reads /ai/settings on mount to label itself; answer it here so
    // per-test `mockResolvedValueOnce` queues keep their own ordering.
    (fetchWithAuth as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v1/ai/settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              provider: 'gemini',
              source: 'user',
              provider_label: 'Google Gemini',
              effective_model: 'gemini-2.5-flash',
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('names the connected model in the header and welcome message', async () => {
    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));

    await waitFor(() => {
      expect(screen.getByText('Google Gemini · gemini-2.5-flash')).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.getByText(/ขับเคลื่อนด้วย Google Gemini · gemini-2\.5-flash/)).toBeDefined();
    });
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
    (fetchWithAuth as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v1/ai/chat')) {
        return {
          ok: true,
          json: async () => ({
            result: 'success',
            reply: 'สภาพอากาศวันนี้ท้องฟ้าแจ่มใสครับ',
            provider: 'Google Gemini',
            model: 'gemini-2.5-flash',
          }),
        };
      }
      return { ok: true, json: async () => ({ data: { provider: 'gemini', source: 'none' } }) };
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
    (fetchWithAuth as any).mockImplementation(async (url: string, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/api/v1/ai/chat')) {
        return {
          ok: true,
          json: async () => ({
            result: 'success',
            reply: 'จดบันทึกให้เรียบร้อยแล้วครับ: "ซื้อกาแฟ" ✨',
            action: {
              type: 'add_note',
              data: { text: 'ซื้อกาแฟ' },
            },
          }),
        };
      }
      if (target.includes('/api/v1/profile/quick-notes')) {
        return {
          ok: true,
          json: async () => (init?.method === 'PUT' ? { ok: true } : { notes: [] }),
        };
      }
      return { ok: true, json: async () => ({ data: {} }) };
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

    // The note is mirrored into the account-scoped offline cache that the
    // Quick Notes widget and the daily digest read.
    await waitFor(() => {
      const raw = localStorage.getItem('artOffline:v1:local:cache:profile/quick-notes');
      expect(raw).toContain('ซื้อกาแฟ');
    });
  });

  it('sends the current message once and says when the saved key failed', async () => {
    let sent: { history?: { role: string; text: string }[] } = {};

    (fetchWithAuth as any).mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/v1/ai/chat')) {
        sent = JSON.parse(String(init?.body));
        return {
          ok: true,
          json: async () => ({ result: 'success', reply: 'คำตอบจากโหมดพื้นฐาน', degraded: true }),
        };
      }
      return { ok: true, json: async () => ({ data: {} }) };
    });

    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));

    fireEvent.change(screen.getByPlaceholderText(/สั่งงาน เช่น/), {
      target: { value: 'ช่วยคิดแผนงานสัปดาห์หน้า' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('ส่งข้อความ'));
    });

    await waitFor(() => {
      expect(screen.getByText('คำตอบจากโหมดพื้นฐาน')).toBeDefined();
    });

    // The backend appends the new message itself, so echoing it in history made
    // the model receive the same question twice.
    expect(sent.history?.some((turn) => turn.text === 'ช่วยคิดแผนงานสัปดาห์หน้า')).toBe(false);
    expect(screen.getByText(/คีย์ที่เชื่อมไว้ตอบไม่ได้/)).toBeDefined();
  });

  it('restores the saved conversation, renders it, and clears it on demand', async () => {
    localStorage.setItem(
      scopedStorageKey('ai-copilot/history'),
      JSON.stringify([
        { id: 'u1', sender: 'user', text: 'คำถามเก่า', timestamp: '09:00' },
        { id: 'a1', sender: 'assistant', text: '**คำตอบเก่า**', timestamp: '09:01' },
      ]),
    );

    render(<AICopilotDrawer />);
    fireEvent.click(screen.getByLabelText('เปิด AI Copilot'));

    expect(await screen.findByText('คำถามเก่า')).toBeInTheDocument();
    // The answer came back as Markdown, so it is bold rather than "**…**".
    expect(screen.getByText('คำตอบเก่า').tagName).toBe('STRONG');

    fireEvent.click(screen.getByLabelText('ล้างประวัติแชท'));

    expect(screen.queryByText('คำถามเก่า')).toBeNull();
    expect(localStorage.getItem(scopedStorageKey('ai-copilot/history')) ?? '').not.toContain(
      'คำถามเก่า',
    );
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
