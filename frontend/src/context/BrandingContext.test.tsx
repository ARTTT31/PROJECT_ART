import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { BrandingProvider, useBranding } from './BrandingContext';

const { fetchWithAuth } = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth }));

function TestComponent() {
  const { companyName, companyTagline, updateBranding } = useBranding();
  return (
    <div>
      <span data-testid="company-name">{companyName}</span>
      <span data-testid="company-tagline">{companyTagline}</span>
      <button
        data-testid="update-btn"
        onClick={() =>
          updateBranding({
            company_name: 'Super Team',
            company_tagline: 'Custom Tagline',
          })
        }
      >
        Update
      </button>
    </div>
  );
}

describe('BrandingContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company_name: 'Workspace',
        company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        brand_logo_url: '',
      }),
    }) as unknown as typeof fetch;
  });

  it('provides default branding initially', async () => {
    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>,
    );

    expect(screen.getByTestId('company-name').textContent).toBe('Workspace');
    expect(screen.getByTestId('company-tagline').textContent).toBe(
      'จัดการวันทำงานของคุณให้ง่ายขึ้น',
    );

    // Wait for initial branding fetch to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders the server-provided branding and never localStorage during SSR', () => {
    localStorage.setItem(
      'workspace_branding',
      JSON.stringify({ company_name: 'Graphite', company_tagline: 'เรียบง่ายแต่ทรงพลัง' }),
    );

    // The root layout reads the name from the API and hands it down, so the
    // first HTML already carries the workspace's own name.
    const seeded = renderToString(
      <BrandingProvider
        initialBranding={{ company_name: 'Graphite', company_tagline: 'เรียบง่ายแต่ทรงพลัง' }}
      >
        <TestComponent />
      </BrandingProvider>,
    );
    expect(seeded).toContain('Graphite');
    expect(seeded).not.toContain('Workspace');

    // Without it the neutral defaults are what the server renders. Reading the
    // cache here — which is what this provider used to do — made the browser's
    // first render disagree with the HTML and threw React #418 in the sidebar.
    const neutral = renderToString(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>,
    );
    expect(neutral).toContain('Workspace');
    expect(neutral).not.toContain('Graphite');
  });

  it('drops the cache written under the retired brand key', async () => {
    localStorage.setItem(
      'art_workspace_branding',
      JSON.stringify({ company_name: 'Workspace' }),
    );
    localStorage.setItem('art_workspace_branding_at', String(Date.now()));

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>,
    );

    // The retired name never paints, and the stale keys are gone for good.
    expect(screen.getByTestId('company-name').textContent).toBe('Workspace');
    expect(localStorage.getItem('art_workspace_branding')).toBeNull();
    expect(localStorage.getItem('art_workspace_branding_at')).toBeNull();
  });

  it('refetches on every load so a rename is not stuck behind a cached value', async () => {
    localStorage.setItem(
      'workspace_branding',
      JSON.stringify({ company_name: 'ชื่อเดิม', company_tagline: 'เดิม' }),
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ company_name: 'ทีมใหม่', company_tagline: 'ใหม่' }),
    }) as unknown as typeof fetch;

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>,
    );

    // The cache still paints after mount, then the backend answer replaces it.
    expect(screen.getByTestId('company-name').textContent).toBe('ชื่อเดิม');
    await waitFor(() => {
      expect(screen.getByTestId('company-name').textContent).toBe('ทีมใหม่');
    });
  });

  it('updates branding when updateBranding is called', async () => {
    // The provider also asks for this account's personal workspace branding on
    // mount; answer that with "signed out" and the save call with the new values.
    fetchWithAuth.mockImplementation(async (path: string) =>
      String(path).includes('workspace-branding')
        ? { ok: false, status: 401, json: async () => ({}) }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              company_name: 'Super Team',
              company_tagline: 'Custom Tagline',
              brand_logo_url: '',
            }),
          },
    );

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>,
    );

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('company-name').textContent).toBe('Super Team');
      expect(screen.getByTestId('company-tagline').textContent).toBe('Custom Tagline');
    });
  });
});
