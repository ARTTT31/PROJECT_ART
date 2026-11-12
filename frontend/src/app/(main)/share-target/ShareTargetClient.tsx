'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, Check, ArrowRight, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { writeCached } from '@/lib/offline/localStore';
import { showToast } from '@/utils/sweetalert';
import { hapticSuccess, hapticTap } from '@/utils/haptics';

interface ShareTargetClientProps {
  initialTitle?: string;
  initialText?: string;
  initialUrl?: string;
}

export default function ShareTargetClient({
  initialTitle = '',
  initialText = '',
  initialUrl = '',
}: ShareTargetClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Combine shared parts intelligently
  const combinedInitial = [initialTitle, initialText, initialUrl]
    .filter(Boolean)
    .join(' - ');

  const [noteText, setNoteText] = useState(combinedInitial);

  const handleSaveToNotes = async () => {
    if (!noteText.trim()) return;
    setIsSaving(true);
    hapticTap();

    try {
      // 1. Fetch existing notes
      const res = await fetchWithAuth('/api/v1/profile/quick-notes');
      let currentNotes: Array<{ id: string; text: string; done: boolean }> = [];
      if (res.ok) {
        const body = await res.json();
        currentNotes = Array.isArray(body.notes) ? body.notes : [];
      }

      const newNote = {
        id: `note-${Date.now()}`,
        text: noteText.trim().slice(0, 200),
        done: false,
      };

      const updated = [newNote, ...currentNotes];

      // 2. Save updated notes
      const saveRes = await fetchWithAuth('/api/v1/profile/quick-notes', {
        method: 'PUT',
        body: JSON.stringify({ notes: updated }),
      });

      if (!saveRes.ok) {
        throw new Error('บันทึกไม่สำเร็จ');
      }

      writeCached('profile/quick-notes', { notes: updated });
      hapticSuccess();
      showToast('บันทึกลงโน้ตด่วนเรียบร้อยแล้ว', 'success');
      router.push('/dashboard');
    } catch {
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-6 shadow-xs">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)]">
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-apple-headline font-semibold text-[var(--ink)]">
              แชร์ข้อมูลเข้า Workspace
            </h1>
            <p className="text-[12px] text-[var(--ink-muted)]">
              บันทึกข้อความหรือลิงก์จากแอปอื่นลงในโน้ตด่วน
            </p>
          </div>
        </div>

        {/* Content Box */}
        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="shared-content" className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1">
              ข้อความที่จะบันทึก
            </label>
            <textarea
              id="shared-content"
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full rounded-apple-md border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden"
              placeholder="พิมพ์ข้อความที่ต้องการบันทึก..."
            />
          </div>

          {/* Details breakdown if title/url separate */}
          {(initialTitle || initialUrl) && (
            <div className="rounded-apple-md bg-[var(--surface-grouped)] p-3 text-xs text-[var(--ink-secondary)] space-y-1">
              {initialTitle && (
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                  <span className="font-medium text-[var(--ink)] truncate">{initialTitle}</span>
                </div>
              )}
              {initialUrl && (
                <div className="flex items-center gap-1.5 truncate">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate text-[var(--accent-text)]">{initialUrl}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-chip)] active:scale-[0.97]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isSaving || !noteText.trim()}
            onClick={handleSaveToNotes}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.97]"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>บันทึกลงโน้ตด่วน</span>
          </button>
        </div>
      </div>
    </div>
  );
}
