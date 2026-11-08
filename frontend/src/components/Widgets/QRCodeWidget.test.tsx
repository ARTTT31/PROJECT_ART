import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Both renderers need real canvas/SVG measurement, which jsdom does not
// provide; the widget's own state machine is what these tests cover.
vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <div data-testid="qr-preview" />,
}));
vi.mock('jsbarcode', () => ({ default: vi.fn() }));
vi.mock('@/utils/sweetalert', () => ({ showToast: vi.fn() }));

import QRCodeWidget from './QRCodeWidget';

describe('QRCodeWidget', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on Code 128', () => {
    render(<QRCodeWidget />);

    expect(screen.getByRole('heading', { name: 'สร้างบาร์โค้ด Code 128' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code 128 (Barcode)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches to QR Code', () => {
    render(<QRCodeWidget />);

    fireEvent.click(screen.getByRole('button', { name: 'QR Code' }));

    expect(screen.getByRole('heading', { name: 'สร้าง QR Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'QR Code' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('refuses non-ASCII text in Code 128 and points at QR instead', async () => {
    render(<QRCodeWidget />);

    fireEvent.change(screen.getByLabelText('ข้อความสำหรับสร้างโค้ด'), {
      target: { value: 'สินค้าไทย' },
    });

    expect(
      await screen.findByText(/บาร์โค้ด Code 128 รองรับเฉพาะภาษาอังกฤษและตัวเลข/),
    ).toBeInTheDocument();
  });

  it('remembers the typed code for the next visit', async () => {
    render(<QRCodeWidget />);

    fireEvent.change(screen.getByLabelText('ข้อความสำหรับสร้างโค้ด'), {
      target: { value: 'ART-10023' },
    });

    await waitFor(() => {
      const saved = localStorage.getItem('artQrWidgetV2');
      expect(saved).toContain('ART-10023');
    });
  });
});
