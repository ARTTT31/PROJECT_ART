import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuditPage from './page';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { downloadCsv } from '@/lib/csv';
import { showConfirm, showToast } from '@/utils/sweetalert';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

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
  replace.mockClear();
  vi.mocked(showConfirm).mockResolvedValue({ isConfirmed: true } as never);
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
    url.includes('/audit/export') ? response(exportPayload) : response(listPayload),
  );
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

async function openPage() {
  const { container } = render(<AuditPage />);
  await screen.findByText('row 1');
  return { button: screen.getByRole('button', { name: /ส่งออก CSV/ }), container };
}

describe('/audit CSV export', () => {
  it('downloads every row the backend returns, not the 20 on screen', async () => {
    const { button: exportButton, container } = await openPage();
    fireEvent.click(exportButton);

    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));

    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(/^audit-log_all_\d{4}-\d{2}-\d{2}\.csv$/);
    // One header plus all 25 rows; the table only ever held 20.
    expect(csv.split('\r\n')).toHaveLength(26);
    // The address is no longer shown, so it must not leave in the file either.
    expect(csv).not.toContain('10.0.0.1');
    // The row id is what an incident report cites, so the file carries it.
    expect(csv.split('\r\n')[0].startsWith('ID,')).toBe(true);
    expect(csv.split('\r\n')[1].startsWith('1,')).toBe(true);
    expect(csv.split('\r\n')[0]).not.toContain('IP');
    expect(container.textContent).not.toContain('10.0.0.1');
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
    const { button: exportButton } = await openPage();

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
    const { button: exportButton } = await openPage();

    fireEvent.click(exportButton);

    await waitFor(() => expect(showConfirm).toHaveBeenCalled());
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(fetchWithAuth).not.toHaveBeenCalledWith(expect.stringContaining('/audit/export'));
  });

  it('links each account row to the admin console filtered to it', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
      url.includes('/audit/export')
        ? response(exportPayload)
        : response({
            ...listPayload,
            // One account row and one system row (no user) in the same page.
            items: [entry(1), { ...entry(2), user: null }],
            total: 2,
          }),
    );

    render(<AuditPage />);

    const link = await screen.findByRole('link', {
      name: /ดูอุปกรณ์ที่เข้าสู่ระบบของ Somchai/,
    });
    expect(link.getAttribute('href')).toBe('/admin?sessions=somchai%40example.com');
    // The system row has no account to manage, so it gets no link.
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('shows who a revoke was aimed at next to the admin who did it', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
      url.includes('/audit/export')
        ? response(exportPayload)
        : response({
            ...listPayload,
            items: [
              {
                ...entry(1),
                action: 'ADMIN_REVOKE_SESSION',
                target_user: { id: 2, name: 'Somchai', email: 'somchai@example.com' },
              },
            ],
            total: 1,
          }),
    );

    render(<AuditPage />);

    expect(await screen.findByText(/เป้าหมาย: Somchai/)).toBeDefined();
  });

  it('starts from the filters and page in the URL', async () => {
    window.history.replaceState({}, '', '/audit?action=LOGIN_FAILED&q=som&page=2');

    await openPage();

    const listCall = vi
      .mocked(fetchWithAuth)
      .mock.calls.map(([url]) => String(url))
      .find((url) => url.includes('/audit/paginated'));
    expect(listCall).toContain('action=LOGIN_FAILED');
    expect(listCall).toContain('q=som');
    expect(listCall).toContain('page=2');
  });

  it('keeps the URL in step when the page changes', async () => {
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /ถัดไป/ }));

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith('/audit?page=2', { scroll: false }),
    );
  });

  it('keeps a row anchor in the address when the filters are synced', async () => {
    // A shared link points at one entry: rewriting the query must not throw
    // away the part that scrolls to it.
    window.history.replaceState({}, '', '/audit#entry-5');

    await openPage();
    fireEvent.click(screen.getByRole('button', { name: /ถัดไป/ }));

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith('/audit?page=2#entry-5', { scroll: false }),
    );
  });

  it('adopts an anchor set after mount instead of dropping it', async () => {
    await openPage();

    act(() => {
      window.history.replaceState({}, '', '/audit#entry-9');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // Any later filter change must carry the anchor that arrived after mount.
    fireEvent.click(screen.getByRole('button', { name: 'กรองตามช่วงวันที่' }));
    fireEvent.click(await screen.findByRole('button', { name: '30 วัน' }));

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /^\/audit\?dateFrom=\d{4}-\d{2}-\d{2}&dateTo=\d{4}-\d{2}-\d{2}#entry-9$/,
        ),
        { scroll: false },
      ),
    );
  });

  it('does not rewrite the address when it already matches', async () => {
    window.history.replaceState({}, '', '/audit?action=LOGIN_FAILED&q=som&page=2');

    await openPage();

    // Same filters, same page: no pointless history entry on arrival.
    expect(replace).not.toHaveBeenCalled();
  });
});
