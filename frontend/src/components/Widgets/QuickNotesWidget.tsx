'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ListTodo, Loader2, Plus, RotateCw, Trash2 } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

// Mirrors the backend caps (app/schemas/user.py) so a hopeless save is refused
// before it leaves the browser.
const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 200;

interface QuickNote {
  id: string;
  text: string;
  done: boolean;
}

interface NotesResponse {
  notes?: QuickNote[];
}

// Module-level cache. Opening the dashboard remounts this widget, and refetching
// on every mount made the card flash its spinner each time. Keeping the last
// list here lets a remount paint instantly and then revalidate in the background.
let notesCache: QuickNote[] | null = null;

/** Test helper: clear the cache so each case starts from a clean slate. */
export function resetQuickNotesCache() {
  notesCache = null;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function apiErrorMessage(status: number, body: unknown, requestId: string | null): string {
  const payload = body as { detail?: unknown; code?: unknown } | null;
  const suffix = requestId ? ` · รหัสคำขอ ${requestId}` : '';

  if (payload?.code === 'csrf_failed') {
    return `ตรวจสอบความปลอดภัยไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง${suffix}`;
  }
  if (status === 401) return `เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง${suffix}`;
  if (status === 403) return `บัญชีนี้ไม่มีสิทธิ์บันทึกรายการ${suffix}`;
  if (status >= 500) return `เซิร์ฟเวอร์บันทึกไม่สำเร็จ (HTTP ${status})${suffix}`;

  if (Array.isArray(payload?.detail)) {
    const messages = payload.detail
      .map((issue) => (issue && typeof issue === 'object' ? (issue as { msg?: unknown }).msg : null))
      .filter((message): message is string => typeof message === 'string');
    if (messages.length) return `ข้อมูลไม่ถูกต้อง: ${messages.join(' · ')}${suffix}`;
  }
  if (typeof payload?.detail === 'string') return `${payload.detail}${suffix}`;
  return `บันทึกไม่สำเร็จ (HTTP ${status})${suffix}`;
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'Request timeout') {
    return 'การเชื่อมต่อใช้เวลานานเกินไป ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
  }
  if (error instanceof TypeError) return 'เชื่อมต่อระบบบันทึกไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
  return error instanceof Error && error.message ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

export default function QuickNotesWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [notes, setNotes] = useState<QuickNote[]>(() => notesCache ?? []);
  const [draft, setDraft] = useState('');
  // With a cached list there is nothing to wait for: render it right away.
  const [loading, setLoading] = useState(() => notesCache === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<QuickNote[]>(notesCache ?? []);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);

  const load = useCallback(async () => {
    // Only the first visit (no cache yet) needs the spinner; later mounts keep
    // the previous list on screen and refresh it silently.
    if (notesCache === null) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithAuth('/api/v1/profile/quick-notes');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(res.status, body, res.headers.get('X-Request-ID')));
      }
      const data = (await res.json()) as NotesResponse;
      const loaded = Array.isArray(data.notes) ? data.notes : [];
      notesCache = loaded;
      latestRef.current = loaded;
      setNotes(loaded);
    } catch (err) {
      setLoadError(`โหลดรายการไม่สำเร็จ: ${requestErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [load]);

  const persist = useCallback((next: QuickNote[]) => {
    const sequence = ++saveSequenceRef.current;
    setSaving(true);

    // Do not abort a write that may already have reached the database. Queue
    // snapshots in order so a slower earlier request cannot overwrite newer edits.
    const save = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/profile/quick-notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(apiErrorMessage(res.status, body, res.headers.get('X-Request-ID')));
        }
        if (sequence === saveSequenceRef.current) {
          notesCache = next;
          setError(null);
          setJustSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setJustSaved(false), 1800);
        }
      } catch (err) {
        if (sequence === saveSequenceRef.current) setError(requestErrorMessage(err));
      } finally {
        if (sequence === saveSequenceRef.current) setSaving(false);
      }
    };

    const queuedSave = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined,
    );
    return queuedSave;
  }, []);

  /** Apply a change locally, then save it after the user stops typing. */
  const update = useCallback(
    (next: QuickNote[]) => {
      latestRef.current = next;
      // Keep the cache in step with the optimistic update, so leaving and
      // returning before the debounced save finishes shows the edited list.
      notesCache = next;
      setNotes(next);
      setError(null);
      setJustSaved(false);
      if (pendingRef.current) clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(() => {
        void persist(latestRef.current);
      }, 700);
    },
    [persist],
  );

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    if (latestRef.current.length >= MAX_NOTES) {
      setError(`เพิ่มได้สูงสุด ${MAX_NOTES} รายการ`);
      return;
    }
    setDraft('');
    update([
      ...latestRef.current,
      { id: newId(), text: text.slice(0, MAX_NOTE_LENGTH), done: false },
    ]);
  };

  const toggleNote = (id: string) => {
    update(
      latestRef.current.map((note) => (note.id === id ? { ...note, done: !note.done } : note)),
    );
  };

  const removeNote = (id: string) => {
    update(latestRef.current.filter((note) => note.id !== id));
  };

  const remaining = notes.filter((note) => !note.done).length;

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[300px] items-center justify-center rounded-[18px] border border-black/[0.06] bg-white p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดโน้ตด่วน"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#0066cc]" aria-hidden="true" />
      </div>
    );
  }

  if (loadError) {
    return (
      <section className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#34c759]/10 text-[#248a3d]">
            <ListTodo size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold tracking-tight text-[#1d1d1f]">โน้ตด่วน / To-do วันนี้</h3>
            <p className="mt-0.5 text-[12px] text-[#86868b]">ตรวจสอบรายการที่บันทึกไว้</p>
          </div>
        </div>
        <div role="alert" className="mt-5 rounded-[14px] border border-[#ff3b30]/15 bg-[#ff3b30]/[0.06] p-4 text-[13px] leading-relaxed text-[#b42318]">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
          <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[#0066cc] hover:underline">
            <RotateCw size={14} aria-hidden="true" /> ลองโหลดอีกครั้ง
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="quick-notes-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#34c759]/10 text-[#248a3d]">
            <ListTodo size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="quick-notes-title"
              className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]"
            >
              โน้ตด่วน / To-do วันนี้
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {notes.length === 0
                ? 'เพิ่มรายการที่ต้องทำวันนี้'
                : remaining > 0
                  ? `เหลืออีก ${remaining} รายการ`
                  : 'ทำครบทุกอย่างแล้ว 🎉'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-[14px] border border-[#ff3b30]/15 bg-[#ff3b30]/[0.06] px-3.5 py-3 text-[12px] font-medium leading-relaxed text-[#b42318]">
          <span className="flex min-w-0 items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void persist(latestRef.current)}
            className="shrink-0 rounded-full px-2 py-1 font-semibold text-[#0066cc] hover:bg-white"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addNote();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="พิมพ์รายการที่ต้องทำ..."
          aria-label="รายการที่ต้องทำใหม่"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="เพิ่มรายการ"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-white transition-all hover:bg-[#0071e3] active:scale-95 disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </form>

      <ul
        className="mt-3 max-h-[248px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการที่ต้องทำ"
      >
        {notes.length === 0 && (
          <li className="flex min-h-[104px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-3.5 py-5 text-center text-[12.5px] text-[#86868b]">
            <ListTodo size={20} className="mb-2 text-[#a1a1a6]" aria-hidden="true" />
            <span>ยังไม่มีรายการ</span>
            <span className="mt-0.5 text-[11px]">พิมพ์รายการด้านบนเพื่อเริ่มต้น</span>
          </li>
        )}

        {notes.map((note) => (
          <li
            key={note.id}
            className="group flex items-center gap-2 rounded-[12px] bg-[#f5f5f7] px-2.5 py-[7px]"
          >
            <button
              type="button"
              onClick={() => toggleNote(note.id)}
              aria-pressed={note.done}
              aria-label={note.done ? `ยกเลิกทำ ${note.text}` : `ทำเสร็จ ${note.text}`}
              className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/35 focus-visible:ring-offset-1 ${
                note.done
                  ? 'border-[#29a84a] bg-gradient-to-b from-[#4cd964] to-[#24ab45] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(36,171,69,0.35)]'
                  : 'border-[#c9c9ce] bg-gradient-to-b from-white to-[#edeef1] text-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_-1px_2px_rgba(0,0,0,0.07)] hover:border-[#0066cc] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_0_0_3px_rgba(0,102,204,0.10)] active:scale-90'
              }`}
            >
              <Check size={8} strokeWidth={4.5} aria-hidden="true" />
            </button>

            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                note.done ? 'text-[#86868b] line-through' : 'text-[#1d1d1f]'
              }`}
              title={note.text}
            >
              {note.text}
            </span>

            <button
              type="button"
              onClick={() => removeNote(note.id)}
              aria-label={`ลบ ${note.text}`}
              className="shrink-0 rounded-full p-1 text-[#86868b] opacity-100 transition-all hover:bg-white hover:text-[#ff3b30] md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2 text-[10px] text-[#475569]">
        <span>บันทึกอัตโนมัติ</span>
        <span className="inline-flex items-center gap-1">
          {saving && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
          {saving ? 'กำลังบันทึก...' : justSaved ? 'บันทึกแล้ว' : `${notes.length}/${MAX_NOTES}`}
        </span>
      </div>
    </section>
  );
}
