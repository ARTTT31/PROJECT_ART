import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FinanceWidget from './FinanceWidget';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

function putBodies() {
  return api.fetchWithAuth.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(
      ([, init]) =>
        JSON.parse(String((init as RequestInit).body)) as {
          entries: Array<{ id: string; type: string; label: string; amount: number; date: string }>;
        },
    );
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const entries = [
  { id: 'e1', type: 'income', label: 'ขายของ', amount: 1000, date: today() },
  { id: 'e2', type: 'expense', label: 'ค่ากาแฟ', amount: 250.5, date: today() },
];

describe('FinanceWidget', () => {
  beforeEach(() => {
    api.fetchWithAuth.mockReset();
  });

  it('loads entries and shows today’s totals', async () => {
    api.fetchWithAuth.mockResolvedValue(jsonResponse({ entries }));

    render(<FinanceWidget />);

    await screen.findByText('ขายของ');
    expect(screen.getByText('ค่ากาแฟ')).toBeTruthy();
    expect(screen.getByText('1,000')).toBeTruthy();
    expect(screen.getByText('250.5')).toBeTruthy();
    expect(screen.getByText('749.5')).toBeTruthy();
  });

  it('saves the whole list after adding an entry', async () => {
    api.fetchWithAuth.mockResolvedValue(jsonResponse({ entries: [] }));

    render(<FinanceWidget />);
    await screen.findByText('ยังไม่มีรายการวันนี้');

    fireEvent.change(screen.getByLabelText('ชื่อรายการ'), { target: { value: 'ค่าขนม' } });
    fireEvent.change(screen.getByLabelText('จำนวนเงิน'), { target: { value: '35.5' } });
    fireEvent.submit(screen.getByLabelText('เพิ่มรายการ').closest('form') as HTMLFormElement);

    await waitFor(
      () => {
        const bodies = putBodies();
        expect(bodies.length).toBeGreaterThan(0);
        expect(bodies[bodies.length - 1].entries).toHaveLength(1);
        expect(bodies[bodies.length - 1].entries[0]).toMatchObject({
          label: 'ค่าขนม',
          type: 'expense',
          amount: 35.5,
        });
      },
      { timeout: 3000 },
    );
  });

  it('flushes a pending debounced save when the widget unmounts', async () => {
    api.fetchWithAuth.mockResolvedValue(jsonResponse({ entries: [] }));

    const view = render(<FinanceWidget />);
    await screen.findByText('ยังไม่มีรายการวันนี้');

    fireEvent.change(screen.getByLabelText('ชื่อรายการ'), { target: { value: 'ค่าเดินทาง' } });
    fireEvent.change(screen.getByLabelText('จำนวนเงิน'), { target: { value: '120' } });
    fireEvent.submit(screen.getByLabelText('เพิ่มรายการ').closest('form') as HTMLFormElement);

    // Unmount inside the 400ms debounce window; the edit must still reach the API.
    view.unmount();

    await waitFor(() => {
      const bodies = putBodies();
      expect(bodies).toHaveLength(1);
      expect(bodies[0].entries[0].label).toBe('ค่าเดินทาง');
    });
  });
});

describe('FinanceWidget safety nets', () => {
  beforeEach(() => {
    api.fetchWithAuth.mockReset();
  });

  const later = new Date();
  later.setDate(later.getDate() - 1);
  const yesterday = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`;

  it('restores a deleted entry from the undo bar', async () => {
    api.fetchWithAuth.mockResolvedValue(jsonResponse({ entries }));

    render(<FinanceWidget />);
    await screen.findByText('ขายของ');

    fireEvent.click(screen.getByLabelText('ลบ ค่ากาแฟ'));
    expect(screen.queryByText('ค่ากาแฟ')).toBeNull();

    fireEvent.click(screen.getByText('เลิกทำ'));
    expect(await screen.findByText('ค่ากาแฟ')).toBeTruthy();
  });

  it('keeps entries another tab saved instead of overwriting them', async () => {
    const otherTab = {
      id: 'remote',
      type: 'expense',
      label: 'รายการจากอีกแท็บ',
      amount: 99,
      date: yesterday,
    };
    api.fetchWithAuth
      .mockResolvedValueOnce(jsonResponse({ entries: [] }))
      .mockResolvedValue(jsonResponse({ entries: [otherTab] }));

    render(<FinanceWidget />);
    await screen.findByText('ยังไม่มีรายการวันนี้');

    fireEvent.change(screen.getByLabelText('ชื่อรายการ'), { target: { value: 'ค่าขนม' } });
    fireEvent.change(screen.getByLabelText('จำนวนเงิน'), { target: { value: '35.5' } });
    fireEvent.submit(screen.getByLabelText('เพิ่มรายการ').closest('form') as HTMLFormElement);

    await waitFor(
      () => {
        const bodies = putBodies();
        expect(bodies.length).toBeGreaterThan(0);
        const ids = bodies[bodies.length - 1].entries.map((e) => e.id);
        expect(ids).toContain('remote');
      },
      { timeout: 3000 },
    );
  });
});
