import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import PersonalReminders from './PersonalReminders';

const DAY = 24 * 60 * 60 * 1000;

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SERVER_ITEMS = [
  { id: 'r1', date: isoOffset(0), title: 'ไปธนาคาร', kind: 'errand', done: false },
  { id: 'r2', date: isoOffset(1), title: 'ลาพักร้อน', kind: 'leave', done: false },
];

function mockServer(reminders: unknown[]) {
  mockFetchWithAuth.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => ({ reminders }) };
  });
}

function putCalls() {
  return mockFetchWithAuth.mock.calls.filter(([, init]) => init?.method === 'PUT');
}

describe('PersonalReminders', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchWithAuth.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists what the server has, with the day it falls on', async () => {
    mockServer(SERVER_ITEMS);
    render(<PersonalReminders />);

    expect(await screen.findByText('ไปธนาคาร')).toBeInTheDocument();
    expect(screen.getByText('วันนี้')).toBeInTheDocument();
    expect(screen.getByText('พรุ่งนี้')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('adds a reminder and saves the whole list', async () => {
    mockServer(SERVER_ITEMS);
    render(<PersonalReminders />);
    await screen.findByText('ไปธนาคาร');

    fireEvent.click(screen.getByRole('button', { name: /เพิ่ม/ }));
    fireEvent.change(screen.getByLabelText('ชื่อรายการที่ต้องเตือน'), {
      target: { value: 'ส่งเอกสาร' },
    });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));

    expect(await screen.findByText('ส่งเอกสาร')).toBeInTheDocument();

    await waitFor(() => expect(putCalls()).toHaveLength(1));
    const body = JSON.parse(String(putCalls()[0][1]?.body));
    expect(body.reminders).toHaveLength(3);
    expect(body.reminders.map((item: { title: string }) => item.title)).toContain('ส่งเอกสาร');
  });

  it('hides a completed reminder from the upcoming list', async () => {
    mockServer(SERVER_ITEMS);
    render(<PersonalReminders />);
    await screen.findByText('ไปธนาคาร');

    fireEvent.click(screen.getByLabelText('ทำเครื่องหมาย ไปธนาคาร ว่าเสร็จแล้ว'));

    await waitFor(() => expect(screen.queryByText('ไปธนาคาร')).not.toBeInTheDocument());
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('keeps the edit on the device while offline', async () => {
    let online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    mockServer(SERVER_ITEMS);
    render(<PersonalReminders />);
    await screen.findByText('ไปธนาคาร');

    // The connection drops between loading the list and editing it.
    online = false;
    fireEvent.click(screen.getByLabelText('ลบ ไปธนาคาร'));

    expect(
      await screen.findByText(/ออฟไลน์ · บันทึกในเครื่องแล้ว/),
    ).toBeInTheDocument();
    expect(screen.queryByText('ไปธนาคาร')).not.toBeInTheDocument();
    expect(putCalls()).toHaveLength(0);
  });
});
