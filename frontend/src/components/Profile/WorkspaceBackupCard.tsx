'use client';

import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

export interface WorkspaceBackupPayload {
  version: number;
  exportedAt: string;
  source: 'ART Workspace';
  data: {
    quickNotes?: unknown[];
    finance?: {
      entries?: unknown[];
      budget?: unknown;
    };
    watchlist?: unknown[];
    quickLinks?: unknown[];
    dashboardLayout?: string | null;
  };
}

export default function WorkspaceBackupCard() {
  const { success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackupPayload | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // ── Handle Export ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch notes, finance, watchlist, and quick links in parallel
      const [notesRes, financeRes, watchlistRes, quickLinksRes] = await Promise.all([
        fetchWithAuth('/api/v1/profile/quick-notes'),
        fetchWithAuth('/api/v1/profile/finance'),
        fetchWithAuth('/api/v1/profile/watchlist'),
        fetchWithAuth('/api/v1/profile/quick-links'),
      ]);

      const notesData = notesRes.ok ? await notesRes.json() : { notes: [] };
      const financeData = financeRes.ok ? await financeRes.json() : { entries: [], budget: null };
      const watchlistData = watchlistRes.ok ? await watchlistRes.json() : { symbols: [] };
      const quickLinksData = quickLinksRes.ok ? await quickLinksRes.json() : [];

      const backup: WorkspaceBackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: 'ART Workspace',
        data: {
          quickNotes: notesData.notes || [],
          finance: {
            entries: financeData.entries || [],
            budget: financeData.budget || null,
          },
          watchlist: watchlistData.symbols || [],
          quickLinks: Array.isArray(quickLinksData) ? quickLinksData : [],
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const nowStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `art-workspace-backup-${nowStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('สำเร็จ', 'ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Backup export failed:', err);
      showError('เกิดข้อผิดพลาด', 'ไม่สามารถส่งออกข้อมูลสำรองได้');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Handle File Select ───────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as WorkspaceBackupPayload;
        if (!parsed || typeof parsed !== 'object' || !parsed.data) {
          throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง');
        }
        setPendingBackup(parsed);
        setConfirmModalOpen(true);
      } catch (err) {
        console.error('Parse backup file error:', err);
        showError('ไฟล์ไม่ถูกต้อง', 'ไฟล์สำรองไม่ถูกต้อง หรือรูปแบบ JSON ผิดพลาด');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ── Handle Confirm Restore ────────────────────────────────────────────────
  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;
    setIsImporting(true);
    try {
      const { quickNotes, finance, watchlist } = pendingBackup.data;
      const tasks: Promise<Response>[] = [];

      if (Array.isArray(quickNotes)) {
        tasks.push(
          fetchWithAuth('/api/v1/profile/quick-notes', {
            method: 'PUT',
            body: JSON.stringify({ notes: quickNotes }),
          }),
        );
      }

      if (finance && (Array.isArray(finance.entries) || finance.budget !== undefined)) {
        tasks.push(
          fetchWithAuth('/api/v1/profile/finance', {
            method: 'PUT',
            body: JSON.stringify({
              entries: finance.entries || [],
              budget: finance.budget,
            }),
          }),
        );
      }

      if (Array.isArray(watchlist)) {
        tasks.push(
          fetchWithAuth('/api/v1/profile/watchlist', {
            method: 'PUT',
            body: JSON.stringify({ symbols: watchlist }),
          }),
        );
      }

      await Promise.all(tasks);
      showSuccess('สำเร็จ', 'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว!');
      setConfirmModalOpen(false);
      setPendingBackup(null);

      // Trigger custom events so mounted widgets re-read latest data
      window.dispatchEvent(new Event('profile-data-restored'));
    } catch (err) {
      console.error('Restore failed:', err);
      showError('เกิดข้อผิดพลาด', 'กู้คืนข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsImporting(false);
    }
  };

  const noteCount = pendingBackup?.data?.quickNotes?.length ?? 0;
  const financeCount = pendingBackup?.data?.finance?.entries?.length ?? 0;
  const watchlistCount = pendingBackup?.data?.watchlist?.length ?? 0;

  return (
    <div
      data-testid="workspace-backup-card"
      className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--surface-chip)] text-[var(--accent)]">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">
            สำรองและกู้คืนข้อมูล (Backup & Restore)
          </h3>
          <p className="text-xs text-[var(--ink-secondary)]">
            ดาวน์โหลดหรือนำเข้าข้อมูลส่วนตัว (โน้ตด่วน, บันทึกการเงิน, รายการติดตาม) เป็นไฟล์ JSON
          </p>
        </div>
      </div>

      {/* Action Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Export Box */}
        <div className="flex flex-col justify-between rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Download className="h-4 w-4 text-[var(--accent)]" />
              <span>ส่งออกข้อมูลสำรอง</span>
            </div>
            <p className="mt-1 text-xs text-[var(--ink-secondary)] leading-relaxed">
              รวมโน้ตด่วน, บันทึกรายรับ-รายจ่าย, และรายการติดตามหุ้น/ทองคำ ในคลิกเดียว
            </p>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex w-full items-center justify-center gap-2 rounded-apple-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-transform active:scale-[0.95] hover:opacity-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>กำลังรวบรวมข้อมูล...</span>
                </>
              ) : (
                <>
                  <FileJson className="h-3.5 w-3.5" />
                  <span>ดาวน์โหลดไฟล์สำรอง (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Box */}
        <div className="flex flex-col justify-between rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Upload className="h-4 w-4 text-[var(--accent)]" />
              <span>นำเข้าข้อมูลสำรอง</span>
            </div>
            <p className="mt-1 text-xs text-[var(--ink-secondary)] leading-relaxed">
              กู้คืนข้อมูลจากไฟล์ JSON ที่สำรองไว้ พร้อมหน้าต่างตรวจสอบก่อนยืนยัน
            </p>
          </div>

          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="workspace-backup-upload-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-apple-md border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs transition-transform active:scale-[0.95] hover:bg-[var(--surface-chip)]"
            >
              <Upload className="h-3.5 w-3.5 text-[var(--ink-secondary)]" />
              <span>เลือกไฟล์สำรองเพื่อกู้คืน</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--warning-surface)] text-[var(--warning-ink)]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <DialogTitle>ยืนยันการกู้คืนข้อมูล</DialogTitle>
            </div>
            <DialogDescription>
              การกู้คืนจะนำข้อมูลจากไฟล์สำรองมาแทนที่รายการเดิมที่มีอยู่ในปัจจุบัน
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3 py-2">
            <div className="rounded-apple-md border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3 text-xs space-y-2">
              <div className="font-semibold text-[var(--ink)]">รายการข้อมูลที่พบในไฟล์:</div>
              <div className="flex items-center justify-between text-[var(--ink-secondary)]">
                <span>📝 โน้ตด่วน (Quick Notes)</span>
                <span className="font-medium text-[var(--ink)]">{noteCount} รายการ</span>
              </div>
              <div className="flex items-center justify-between text-[var(--ink-secondary)]">
                <span>💰 รายรับ – รายจ่าย (Finance)</span>
                <span className="font-medium text-[var(--ink)]">{financeCount} รายการ</span>
              </div>
              <div className="flex items-center justify-between text-[var(--ink-secondary)]">
                <span>📈 รายการติดตาม (Watchlist)</span>
                <span className="font-medium text-[var(--ink)]">{watchlistCount} สัญลักษณ์</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              วันเวลาที่สำรอง: {pendingBackup?.exportedAt ? new Date(pendingBackup.exportedAt).toLocaleString('th-TH') : 'ไม่ระบุ'}
            </p>
          </DialogBody>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isImporting}
              className="rounded-apple-md border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] active:scale-[0.95]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmRestore}
              disabled={isImporting}
              className="flex items-center justify-center gap-2 rounded-apple-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-xs active:scale-[0.95] disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>กำลังกู้คืน...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>ยืนยันกู้คืนข้อมูล</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
