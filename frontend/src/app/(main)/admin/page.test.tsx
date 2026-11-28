import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from './page';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const { authUser } = vi.hoisted(() => ({
  authUser: {
    role: 'admin',
    name: 'Admin',
    email: 'admin@example.com',
    two_factor_enabled: true as boolean | undefined,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    status: 'authenticated',
  }),
}));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

vi.mock('@/components/ui/PageHeader', () => ({
  usePageHeading: () => ({ current: null }),
}));

// The card has its own tests. Here it only has to show what the page handed it,
// which is the part this file is about.
vi.mock('@/components/Admin/ActiveSessionsCard', () => ({
  default: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="active-sessions-query">{initialQuery}</div>
  ),
}));

vi.mock('@/components/Admin/RegistrationPolicyCard', () => ({
  RegistrationPolicyCard: () => null,
}));
vi.mock('@/components/Admin/PageAccessCard', () => ({ default: () => null }));
vi.mock('@/components/Admin/UserManagement', () => ({ default: () => null }));

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers({ 'X-Total-Count': '0' }),
  } as unknown as Response;
}

beforeEach(() => {
  authUser.two_factor_enabled = true;
  vi.mocked(fetchWithAuth).mockClear();
  vi.mocked(fetchWithAuth).mockResolvedValue(ok([]));
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('/admin ?sessions=', () => {
  it('passes the account from the URL to the device card as its filter', async () => {
    window.history.replaceState({}, '', '/admin?sessions=somchai%40example.com');

    render(<AdminPage />);

    const card = await screen.findByTestId('active-sessions-query');
    expect(card.textContent).toBe('somchai@example.com');
  });

  it('leaves the device card unfiltered when the URL has no account', async () => {
    window.history.replaceState({}, '', '/admin');

    render(<AdminPage />);

    const card = await screen.findByTestId('active-sessions-query');
    expect(card.textContent).toBe('');
  });

  it('shows the 2FA setup path without calling admin APIs', async () => {
    authUser.two_factor_enabled = false;
    window.history.replaceState({}, '', '/admin');

    render(<AdminPage />);

    expect(await screen.findByText('ต้องเปิด 2FA ก่อนใช้ส่วนผู้ดูแล')).toBeDefined();
    expect(screen.queryByTestId('active-sessions-query')).toBeNull();
    expect(fetchWithAuth).not.toHaveBeenCalled();
  });
});
