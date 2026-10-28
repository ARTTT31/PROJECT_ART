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

const uploadBrandLogo = vi.fn();
const updateBranding = vi.fn();

function renderCard(isAdmin = true) {
  return render(<BrandingCard isAdmin={isAdmin} />);
}

function logoInput(): HTMLInputElement {
  return screen.getByLabelText('เลือกรูปโลโก้ของทีม') as HTMLInputElement;
}

function pngFile(name = 'logo.png'): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
}

describe('BrandingCard', () => {
  beforeEach(() => {
    uploadBrandLogo.mockReset().mockResolvedValue({ success: true });
    updateBranding.mockReset().mockResolvedValue({ success: true });
    branding.useBranding.mockReturnValue({
      companyName: 'ART Workspace',
      companyTagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
      brandLogoUrl: '',
      registrationMode: 'approval',
      isLoading: false,
      refreshBranding: vi.fn(),
      updateBranding,
      uploadBrandLogo,
    });
  });

  it('uploads a selected logo image', async () => {
    renderCard();
    const file = pngFile();

    fireEvent.change(logoInput(), { target: { files: [file] } });

    await waitFor(() => expect(uploadBrandLogo).toHaveBeenCalledWith(file));
    await waitFor(() => expect(swal.showSuccess).toHaveBeenCalled());
  });

  it('refuses a file larger than 1MB without calling the API', async () => {
    renderCard();
    const file = pngFile('huge.png');
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 });

    fireEvent.change(logoInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(swal.showToast).toHaveBeenCalledWith(expect.stringContaining('1MB'), 'warning'),
    );
    expect(uploadBrandLogo).not.toHaveBeenCalled();
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
    expect(uploadBrandLogo).not.toHaveBeenCalled();
  });

  it('resets to the default logo when the admin confirms', async () => {
    branding.useBranding.mockReturnValue({
      companyName: 'ART Workspace',
      companyTagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
      brandLogoUrl: 'data:image/webp;base64,AAA',
      registrationMode: 'approval',
      isLoading: false,
      refreshBranding: vi.fn(),
      updateBranding,
      uploadBrandLogo,
    });
    swal.showConfirm.mockResolvedValue({ isConfirmed: true });

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'ใช้โลโก้เริ่มต้น' }));

    await waitFor(() => expect(updateBranding).toHaveBeenCalledWith({ brand_logo_url: '' }));
  });

  it('saves the name without resending the logo field', async () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /บันทึกชื่อทีมและแบรนด์/ }));

    await waitFor(() =>
      expect(updateBranding).toHaveBeenCalledWith({
        company_name: 'ART Workspace',
        company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
        registration_mode: 'approval',
      }),
    );
  });

  it('hides the logo controls from non-admins', () => {
    renderCard(false);

    expect(screen.queryByLabelText('เลือกรูปโลโก้ของทีม')).toBeNull();
    expect(screen.queryByRole('button', { name: /อัปโหลดโลโก้|เปลี่ยนโลโก้/ })).toBeNull();
  });
});
