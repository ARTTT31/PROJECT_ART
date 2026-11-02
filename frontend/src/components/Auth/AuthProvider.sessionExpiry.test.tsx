/**
 * Regression test for the 401 burst on the dashboard.
 *
 * A page load returns a stale `access_token` cookie (30-minute lifetime).
 * React runs the effects of a parent AFTER its children, so the widgets used to
 * fire their authenticated requests before `AuthProvider` refreshed the token:
 * every endpoint answered 401 together and the console filled with red lines
 * (plus WeatherWidget showed "ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้").
 *
 * These tests mount the real provider with real widgets against a fake backend
 * that behaves like the API (401 while the access token is the stale one, 200
 * once /auth/refresh has rotated it) and assert that no request is ever
 * rejected.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const router = {
  replace: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const CACHED_USER = {
  id: 1,
  email: 'user@example.com',
  name: 'หมวดต้อนรับ',
  role: 'user',
};

const TODAY = (() => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
})();

const FINANCE_ENTRIES = [
  { id: 'e1', type: 'income', label: 'ขายของ', amount: 1000, date: TODAY },
  { id: 'e2', type: 'expense', label: 'ค่ากาแฟ', amount: 250.5, date: TODAY },
];

const OIL_PRICES = [
  { key: 'gasohol_95', name: 'Gasohol 95', price: 36.55, unit: 'บาท/ลิตร', icon: 'fuel' },
  { key: 'diesel', name: 'Diesel', price: 29.94, unit: 'บาท/ลิตร', icon: 'fuel' },
];

const REFRESH_PATH = '/api/v1/auth/refresh';
const FINANCE_PATH = '/api/v1/profile/finance';
const OIL_PATH = '/api/v1/oil-prices/oil-prices';

function jsonResponse(body: unknown, status = 200) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  return { ...response, clone: () => jsonResponse(body, status) } as unknown as Response;
}

/**
 * Fake backend that mirrors the real auth contract: while the access token is
 * the expired one, every authenticated endpoint answers 401; /auth/refresh
 * rotates it first (unless `refreshOk` is false, i.e. the refresh token itself
 * was revoked).
 */
function installBackend({ refreshOk = true }: { refreshOk?: boolean } = {}) {
  const state = {
    accessTokenFresh: false,
    refreshCalls: 0,
    // Requests that reached an authenticated endpoint with a stale token.
    // In the real app each of these is a 401 in the console.
    rejectedWhileExpired: [] as string[],
    paths: [] as string[],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      state.paths.push(path);

      if (path.endsWith(REFRESH_PATH)) {
        state.refreshCalls += 1;
        if (!refreshOk) return jsonResponse({ detail: 'Session revoked' }, 401);
        state.accessTokenFresh = true;
        return jsonResponse({ result: 'success', data: {} });
      }

      if (!state.accessTokenFresh) {
        state.rejectedWhileExpired.push(path);
        return jsonResponse({ detail: 'Not authenticated' }, 401);
      }

      if (path.includes('/api/v1/profile/me')) return jsonResponse(CACHED_USER);
      if (path.includes(FINANCE_PATH)) return jsonResponse({ entries: FINANCE_ENTRIES });
      if (path.includes(OIL_PATH)) {
        return jsonResponse({
          success: true,
          prices: OIL_PRICES,
          update_date: '10:00',
          source: 'test',
        });
      }
      return jsonResponse({ result: 'success', data: {} });
    }),
  );

  return state;
}

/** The dashboard-shaped tree: provider above, widgets (its descendants) below. */
async function renderDashboard() {
  const [{ AuthProvider }, { default: FinanceWidget }, { default: OilPriceWidget }] =
    await Promise.all([
      import('./AuthProvider'),
      import('@/components/Widgets/FinanceWidget'),
      import('@/components/Widgets/OilPriceWidget'),
    ]);

  render(
    <AuthProvider>
      <FinanceWidget />
      <OilPriceWidget />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  router.replace.mockReset();
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(CACHED_USER));
});

describe('dashboard page load with an expired access token', () => {
  it('refreshes the token before the widgets call the API, so nothing 401s', async () => {
    const backend = installBackend();

    await renderDashboard();

    // Both widgets managed to load their data on the first attempt…
    expect(await screen.findByText('ขายของ')).toBeTruthy();
    expect(await screen.findByText('ดีเซล')).toBeTruthy();
    expect(screen.getByText('29.94')).toBeTruthy();

    // …because the refresh happened first, exactly once, and no authenticated
    // request was ever sent with the stale token.
    expect(backend.rejectedWhileExpired).toEqual([]);
    expect(backend.refreshCalls).toBe(1);
    expect(backend.paths.indexOf(REFRESH_PATH)).toBeLessThan(backend.paths.indexOf(FINANCE_PATH));
    expect(backend.paths.indexOf(REFRESH_PATH)).toBeLessThan(backend.paths.indexOf(OIL_PATH));
  });

  it('clears the session and leaves for /login when the refresh token is revoked', async () => {
    const backend = installBackend({ refreshOk: false });

    await renderDashboard();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));

    // A dead session is not worth a request: the widgets answer themselves with
    // the same 401 the API would have sent, so the console stays quiet.
    expect(backend.paths).toEqual([REFRESH_PATH]);
    expect(backend.rejectedWhileExpired).toEqual([]);
    expect(localStorage.getItem('user')).toBeNull();
  });
});
