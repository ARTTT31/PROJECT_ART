import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandingCard } from './BrandingCard';

const branding = vi.hoisted(() => ({ useBranding: vi.fn() }));
vi.mock('@/context/BrandingContext', () => ({ useBranding: branding.useBranding }));

const swal = vi.hoisted(() => ({
  showToast: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showConfirm: vi.fn(),
}));
vi.mock('@/utils/sweetalert', () => swal);

const uploadWorkspaceLogo = vi.fn();
const uploadBrandLogo = vi.fn();
const updateWorkspaceBranding = vi.fn();
const updateBranding = vi.fn();

function renderCard(scope: 'personal' | 'workspace' = 'personal') {
  return render(<BrandingCard scope={scope} />);
}

function logoInput(): HTMLInputElement {
  return screen.getByLabelText('เลือกรูปโลโก้ของทีม') as HTMLInputElement;
}

function pngFile(name = 'logo.png'): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
}

describe('BrandingCard', () => {
  beforeEach(() => {
    uploadWorkspaceLogo.mockReset().mockResolvedValue({ success: true });
    uploadBrandLogo.mockReset().mockResolvedValue({ success: true });
    updateWorkspaceBranding.mockReset().mockResolvedValue({ success: true });
    updateBranding.mockReset().mockResolvedValue({ success: true });
    branding.useBranding.mockReturnValue({
      companyName: 'ART Workspace',
      companyTagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
      brandLogoUrl: '',
      registrationMode: 'approval',
      workspaceName: '',
      workspaceTagline: '',
      workspaceLogo: '',
      isLoading: false,
      refreshBranding: vi.fn(),
      updateBranding,
      uploadBrandLogo,
      updateWorkspaceBranding,
      uploadWorkspaceLogo,
    });
  });

  it('saves a personal workspace name without resending the logo', async () => {
    renderCard();

    const [nameInput, taglineInput] = screen.getAllByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'ทีมของฉัน' } });
    fireEvent.change(taglineInput, { target: { value: 'งานส่วนตัว' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึกชื่อทีมและโลโก้/ }));

    await waitFor(() =>
      expect(updateWorkspaceBranding).toHaveBeenCalledWith({
        workspace_name: 'ทีมของฉัน',
        workspace_tagline: 'งานส่วนตัว',
      }),
    );
    expect(updateBranding).not.toHaveBeenCalled();
  });

  it('saves the workspace-wide branding through the global endpoint', async () => {
    renderCard('workspace');

    fireEvent.click(screen.getByRole('button', { name: /บันทึกแบรนด์ส่วนกลาง/ }));

    await waitFor(() =>
      expect(updateBranding).toHaveBeenCalledWith({
        company_name: 'ART Workspace',
        company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
      }),
    );
  });

  it('uploads a personal logo through the per-user endpoint', async () => {
    renderCard();
    const file = pngFile();

    fireEvent.change(logoInput(), { target: { files: [file] } });

    await waitFor(() => expect(uploadWorkspaceLogo).toHaveBeenCalledWith(file));
    expect(uploadBrandLogo).not.toHaveBeenCalled();
  });

  it('uploads a workspace logo through the global endpoint', async () => {
    renderCard('workspace');
    const file = pngFile();

    fireEvent.change(logoInput(), { target: { files: [file] } });

    await waitFor(() => expect(uploadBrandLogo).toHaveBeenCalledWith(file));
    expect(uploadWorkspaceLogo).not.toHaveBeenCalled();
  });

  it('refuses a file larger than 1MB without calling the API', async () => {
    renderCard();
    const file = pngFile('huge.png');
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 });

    fireEvent.change(logoInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(swal.showToast).toHaveBeenCalledWith(expect.stringContaining('1MB'), 'warning'),
    );
    expect(uploadWorkspaceLogo).not.toHaveBeenCalled();
  });

  it('refuses an unsupported file type', async () => {
    renderCard();
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });

    fireEvent.change(logoInput(), { target: { files: [svg] } });

    await waitFor(() =>
      expect(swal.showToast).toHaveBeenCalledWith(
        expect.stringContaining('ไม่รองรับ SVG'),
        'warning',
      ),
    );
    expect(uploadWorkspaceLogo).not.toHaveBeenCalled();
  });

  it('resets a personal logo back to the workspace default', async () => {
    branding.useBranding.mockReturnValue({
      companyName: 'ART Workspace',
      companyTagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
      brandLogoUrl: 'data:image/webp;base64,AAA',
      registrationMode: 'approval',
      workspaceName: 'ทีมของฉัน',
      workspaceTagline: '',
      workspaceLogo: 'data:image/webp;base64,AAA',
      isLoading: false,
      refreshBranding: vi.fn(),
      updateBranding,
      uploadBrandLogo,
      updateWorkspaceBranding,
      uploadWorkspaceLogo,
    });
    swal.showConfirm.mockResolvedValue({ isConfirmed: true });

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'ใช้โลโก้เริ่มต้น' }));

    await waitFor(() =>
      expect(updateWorkspaceBranding).toHaveBeenCalledWith({ workspace_logo: '' }),
    );
  });
});
