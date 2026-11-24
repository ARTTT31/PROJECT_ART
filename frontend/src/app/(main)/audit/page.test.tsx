import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditPage from './page';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { downloadCsv } from '@/lib/csv';
import { showConfirm, showToast } from '@/utils/sweetalert';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { role: 'admin', name: 'Admin', email: 'admin@example.com' },
    status: 'authenticated',
  }),
}));

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({
    tr: (th: string, _en: string, vars?: Record<string, unknown>) =>
      vars
        ? th.replace(/\{(\w+)\}/g, (match, key) =>
            key in vars ? String(vars[key]) : match,
          )
        : th,
  }),
}));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
vi.mock('@/utils/sweetalert', () => ({ showConfirm: vi.fn(), showToast: vi.fn() }));

// The DOM download is a spy; the CSV builder stays real so the test sees the
// actual rows and filename the admin would receive.
vi.mock('@/lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/csv')>();
  return { ...actual, downloadCsv: vi.fn() };
});

function entry(id: number) {
  return {
    id,
    user_id: 1,
    action: 'LOGIN_SUCCESS',
    details: `row ${id}`,
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0',
    created_at: '2026-11-20T10:00:00',
    user: { id: 1, name: 'Somchai', email: 'somchai@example.com' },
  };
}

const pageItems = Array.from({ length: 20 }, (_, index) => entry(index + 1));
const exportItems = Array.from({ length: 25 }, (_, index) => entry(index + 1));

const listPayload = {
  items: pageItems,
  page: 1,
  size: 20,
  total: 40,
  hasNext: true,
  hasPrev: false,
};

const exportPayload = {
  items: exportItems,
  total: 40,
  exported: 25,
  truncated: true,
};

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(() => {
  vi.mocked(showConfirm).mockResolvedValue({ isConfirmed: true } as never);
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
    url.includes('/audit/export') ? response(exportPayload) : response(listPayload),
  );
});

async function openPage() {
  render(<AuditPage />);
  await screen.findByText('row 1');
  return screen.getByRole('button', { name: /ส่งออก CSV/ });
}

describe('/audit CSV export', () => {
  it('downloads every row the backend returns, not the 20 on screen', async () => {
    const exportButton = await openPage();
    fireEvent.click(exportButton);

    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));

    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(/^audit-log_all_\d{4}-\d{2}-\d{2}\.csv$/);
    // One header plus all 25 rows; the table only ever held 20.
    expect(csv.split('\r\n')).toHaveLength(26);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('ส่งออก 25 จาก 40 รายการ'),
      'warning',
    );

    // The export runs the filters, never the current page window.
    const exportCall = vi
      .mocked(fetchWithAuth)
      .mock.calls.find(([url]) => String(url).includes('/audit/export'));
    expect(exportCall?.[0]).not.toContain('page=');
  });

  it('puts the selected date range in the filename', async () => {
    const exportButton = await openPage();

    fireEvent.click(screen.getByRole('button', { name: 'กรองตามช่วงวันที่' }));
    fireEvent.click(await screen.findByRole('button', { name: '30 วัน' }));

    fireEvent.click(exportButton);
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));

    const [filename] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(/^audit-log_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv$/);

    const exportCall = vi
      .mocked(fetchWithAuth)
      .mock.calls.find(([url]) => String(url).includes('/audit/export'));
    expect(String(exportCall?.[0])).toContain('dateFrom=');
    expect(String(exportCall?.[0])).toContain('dateTo=');
  });

  it('does not download when the confirmation is dismissed', async () => {
    vi.mocked(showConfirm).mockResolvedValue({ isConfirmed: false } as never);
    const exportButton = await openPage();

    fireEvent.click(exportButton);

    await waitFor(() => expect(showConfirm).toHaveBeenCalled());
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(fetchWithAuth).not.toHaveBeenCalledWith(expect.stringContaining('/audit/export'));
  });
});
