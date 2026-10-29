import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickNotesWidget, { resetQuickNotesCache } from './QuickNotesWidget';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

function lastPutBody(): { notes: Array<{ id: string; text: string; done: boolean }> } {
  const putCalls = api.fetchWithAuth.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
  );
  const init = putCalls[putCalls.length - 1]?.[1] as RequestInit;
  return JSON.parse(String(init.body));
}

async function renderWith(notes: Array<{ id: string; text: string; done: boolean }>) {
  api.fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return jsonResponse({ notes });
    return jsonResponse({ notes });
  });
  render(<QuickNotesWidget />);
  await waitFor(() => expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull());
}

describe('QuickNotesWidget', () => {
  beforeEach(() => {
    api.fetchWithAuth.mockReset();
    resetQuickNotesCache();
  });

  it('paints the cached list on a remount instead of loading again', async () => {
    const notes = [{ id: 'n1', text: 'งานที่ค้าง', done: false }];
    api.fetchWithAuth.mockResolvedValue(jsonResponse({ notes }));

    const first = render(<QuickNotesWidget />);
    await screen.findByText('งานที่ค้าง');
    first.unmount();

    render(<QuickNotesWidget />);
    expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull();
    expect(screen.getByText('งานที่ค้าง')).toBeTruthy();
  });

  it('shows the empty state for a new account', async () => {
    await renderWith([]);

    expect(screen.getByText(/ยังไม่มีรายการ/)).toBeTruthy();
    expect(screen.getByText('0/50')).toBeTruthy();
  });

  it('adds a note and saves the whole list', async () => {
    await renderWith([]);

    const input = screen.getByLabelText('รายการที่ต้องทำใหม่');
    fireEvent.change(input, { target: { value: 'ซื้อกระดาษ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.getByText('ซื้อกระดาษ')).toBeTruthy();

    await waitFor(
      () => {
        const body = lastPutBody();
        expect(body.notes.map((note) => note.text)).toEqual(['ซื้อกระดาษ']);
        expect(body.notes[0].done).toBe(false);
      },
      { timeout: 3000 },
    );
    // The draft field is cleared so the next item can be typed straight away.
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('marks a note as done and saves the new state', async () => {
    await renderWith([{ id: 'n1', text: 'โทรหาลูกค้า', done: false }]);

    fireEvent.click(screen.getByLabelText('ทำเสร็จ โทรหาลูกค้า'));

    await waitFor(
      () => {
        expect(lastPutBody().notes[0].done).toBe(true);
      },
      { timeout: 3000 },
    );
    expect(screen.getByText('ทำครบทุกอย่างแล้ว 🎉')).toBeTruthy();
  });

  it('removes a note from the list and the saved payload', async () => {
    await renderWith([{ id: 'n1', text: 'งานที่จะลบ', done: false }]);

    fireEvent.click(screen.getByLabelText('ลบ งานที่จะลบ'));

    expect(screen.queryByText('งานที่จะลบ')).toBeNull();
    await waitFor(
      () => {
        expect(lastPutBody().notes).toEqual([]);
      },
      { timeout: 3000 },
    );
  });

  it('queues saves so a later edit is written after an earlier request finishes', async () => {
    let resolveFirstSave: ((value: ReturnType<typeof jsonResponse>) => void) | undefined;
    let writeCount = 0;
    api.fetchWithAuth.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writeCount += 1;
        if (writeCount === 1) {
          return new Promise((resolve) => {
            resolveFirstSave = resolve;
          });
        }
        return jsonResponse({ notes: JSON.parse(String(init.body)).notes });
      }
      return jsonResponse({ notes: [] });
    });
    render(<QuickNotesWidget />);
    await waitFor(() => expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull());

    vi.useFakeTimers();
    try {
      const input = screen.getByLabelText('รายการที่ต้องทำใหม่');
      fireEvent.change(input, { target: { value: 'รายการที่กำลังบันทึก' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
      });
      expect(writeCount).toBe(1);

      fireEvent.click(screen.getByLabelText('ทำเสร็จ รายการที่กำลังบันทึก'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
      });
      expect(writeCount).toBe(1);

      resolveFirstSave?.(jsonResponse({ notes: [{ id: 'n1', text: 'รายการที่กำลังบันทึก', done: false }] }));
      vi.useRealTimers();
      await waitFor(() => expect(writeCount).toBe(2));
      expect(lastPutBody().notes[0].done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an actionable server error with its request id when saving fails', async () => {
    api.fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'X-Request-ID': 'req-123' }),
          json: async () => ({ detail: 'database unavailable' }),
        };
      }
      return jsonResponse({ notes: [] });
    });
    render(<QuickNotesWidget />);
    await waitFor(() => expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull());

    const input = screen.getByLabelText('รายการที่ต้องทำใหม่');
    fireEvent.change(input, { target: { value: 'งานที่บันทึกไม่ผ่าน' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await screen.findByText(/เซิร์ฟเวอร์บันทึกไม่สำเร็จ \(HTTP 503\).*req-123/, undefined, { timeout: 3000 });
  });

  it('reports a stale CSRF token clearly', async () => {
    api.fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return {
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'csrf_failed' }),
        };
      }
      return jsonResponse({ notes: [] });
    });
    render(<QuickNotesWidget />);
    await waitFor(() => expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull());

    const input = screen.getByLabelText('รายการที่ต้องทำใหม่');
    fireEvent.change(input, { target: { value: 'รายการทดสอบ CSRF' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await screen.findByText(/ตรวจสอบความปลอดภัยไม่สำเร็จ/, undefined, { timeout: 3000 });
  });
});
