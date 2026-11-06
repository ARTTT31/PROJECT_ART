import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkspaceBackupCard from './WorkspaceBackupCard';

const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/components/Toast/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

describe('WorkspaceBackupCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders backup & restore actions', () => {
    render(<WorkspaceBackupCard />);
    expect(screen.getByText('สำรองและกู้คืนข้อมูล (Backup & Restore)')).toBeDefined();
    expect(screen.getByText('ส่งออกข้อมูลสำรอง')).toBeDefined();
    expect(screen.getByText('นำเข้าข้อมูลสำรอง')).toBeDefined();
  });

  it('handles export by fetching user workspace data', async () => {
    (fetchWithAuth as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('quick-notes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [{ id: '1', text: 'Note 1' }] }) });
      }
      if (url.includes('finance')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ id: 'f1', amount: 100 }], budget: 5000 }) });
      }
      if (url.includes('watchlist')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ symbols: ['SET50', 'PTT.BK'] }) });
      }
      if (url.includes('quick-links')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<WorkspaceBackupCard />);
    const exportBtn = screen.getByText('ดาวน์โหลดไฟล์สำรอง (.json)');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/quick-notes');
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/finance');
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/watchlist');
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/profile/quick-links');
      expect(mockSuccess).toHaveBeenCalledWith('สำเร็จ', 'ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยแล้ว');
    });
  });

  it('validates file upload and opens restore confirmation dialog', async () => {
    render(<WorkspaceBackupCard />);
    const fileInput = document.getElementById('workspace-backup-upload-input') as HTMLInputElement;

    const mockBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'ART Workspace',
      data: {
        quickNotes: [{ id: 'n1', text: 'Task 1' }, { id: 'n2', text: 'Task 2' }],
        finance: { entries: [{ id: 'e1', amount: 50 }], budget: 2000 },
        watchlist: ['BTC-USD'],
      },
    };

    const file = new File([JSON.stringify(mockBackup)], 'backup.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('ยืนยันการกู้คืนข้อมูล')).toBeDefined();
      expect(screen.getByText('2 รายการ')).toBeDefined();
      expect(screen.getByText('1 รายการ')).toBeDefined();
      expect(screen.getByText('1 สัญลักษณ์')).toBeDefined();
    });

    // Confirm restore
    (fetchWithAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const confirmBtn = screen.getByText('ยืนยันกู้คืนข้อมูล');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/quick-notes',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/finance',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/watchlist',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(mockSuccess).toHaveBeenCalledWith('สำเร็จ', 'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว!');
    });
  });
});
