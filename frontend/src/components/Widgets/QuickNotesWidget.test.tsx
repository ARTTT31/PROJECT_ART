import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickNotesWidget from './QuickNotesWidget';

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

  it('shows an error banner when the save fails', async () => {
    api.fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: false, json: async () => ({}) };
      return jsonResponse({ notes: [] });
    });
    render(<QuickNotesWidget />);
    await waitFor(() => expect(screen.queryByLabelText('กำลังโหลดโน้ตด่วน')).toBeNull());

    const input = screen.getByLabelText('รายการที่ต้องทำใหม่');
    fireEvent.change(input, { target: { value: 'งานที่บันทึกไม่ผ่าน' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await screen.findByText(/บันทึกไม่สำเร็จ/, undefined, { timeout: 3000 });
  });
});
