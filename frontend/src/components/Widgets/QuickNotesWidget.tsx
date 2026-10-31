'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ListTodo, Loader2, Plus, RotateCw, Trash2 } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { readUserCookie } from '@/lib/api/userCookie';

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
//
// The cache is scoped to the signed-in account: a module-level array used to
// survive sign-out, so a second user on the same tab could see (and, before the
// background revalidation, even save) the previous account's notes.
let notesCache: { userId: string; notes: QuickNote[] } | null = null;

function currentUserId(): string {
  const cookie = readUserCookie();
  if (cookie && typeof cookie === 'object' && !Array.isArray(cookie)) {
    const id = (cookie as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  // Before the cookie exists (tests, first paint) a single local bucket is fine;
  // a real account switch always comes with a different id.
  return 'local';
}

function readNotesCache(): QuickNote[] | null {
  return notesCache && notesCache.userId === currentUserId() ? notesCache.notes : null;
}

function writeNotesCache(notes: QuickNote[]) {
  notesCache = { userId: currentUserId(), notes };
}

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
  const [notes, setNotes] = useState<QuickNote[]>(() => readNotesCache() ?? []);
  const [draft, setDraft] = useState('');
  // With a cached list there is nothing to wait for: render it right away.
  const [loading, setLoading] = useState(() => readNotesCache() === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<QuickNote[]>(notes);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);
  // Bumped by every local edit and every completed save. A background load
  // that started before one of those must not replace the newer local list.
  const revisionRef = useRef(0);

  const load = useCallback(async () => {
    const startedAtRevision = revisionRef.current;
    // Only the first visit (no cache yet) needs the spinner; later mounts keep
    // the previous list on screen and refresh it silently.
    if (readNotesCache() === null) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithAuth('/api/v1/profile/quick-notes');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(res.status, body, res.headers.get('X-Request-ID')));
      }
      const data = (await res.json()) as NotesResponse;
      // The user edited (or another save completed) while this request was in
      // flight; its response is already stale.
      if (revisionRef.current !== startedAtRevision) return;
      const loaded = Array.isArray(data.notes) ? data.notes : [];
      writeNotesCache(loaded);
      latestRef.current = loaded;
      setNotes(loaded);
    } catch (err) {
      setLoadError(`โหลดรายการไม่สำเร็จ: ${requestErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

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
          revisionRef.current += 1;
          writeNotesCache(next);
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

  useEffect(() => {
    void load();
    return () => {
      // Flush an edit made inside the debounce window when the widget unmounts;
      // the optimistic list in the cache is not on the server until this runs.
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
        void persist(latestRef.current);
      }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [load, persist]);

  /** Apply a change locally, then save it after the user stops typing. */
  const update = useCallback(
    (next: QuickNote[]) => {
      revisionRef.current += 1;
      latestRef.current = next;
      // Keep the cache in step with the optimistic update, so leaving and
      // returning before the debounced save finishes shows the edited list.
      writeNotesCache(next);
      setNotes(next);
      setError(null);
      setJustSaved(false);
      if (pendingRef.current) clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
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
        className="flex h-full min-h-[300px] items-center justify-center rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดโน้ตด่วน"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
      </div>
    );
  }

  if (loadError) {
    return (
      <section className="flex h-full flex-col rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--success-soft)] text-[var(--success-ink)]">
            <ListTodo size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold tracking-tight text-[var(--ink)]">โน้ตด่วน / To-do วันนี้</h3>
            <p className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">ตรวจสอบรายการที่บันทึกไว้</p>
          </div>
        </div>
        <div role="alert" className="mt-5 rounded-[14px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-[13px] leading-relaxed text-[var(--danger-ink)]">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
          <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[var(--accent-text)] hover:underline">
            <RotateCw size={14} aria-hidden="true" /> ลองโหลดอีกครั้ง
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="quick-notes-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--success-soft)] text-[var(--success-ink)]">
            <ListTodo size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="quick-notes-title"
              className="truncate text-[16px] font-bold tracking-tight text-[var(--ink)]"
            >
              โน้ตด่วน / To-do วันนี้
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-tertiary)]">
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
        <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-[14px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3.5 py-3 text-[12px] font-medium leading-relaxed text-[var(--danger-ink)]">
          <span className="flex min-w-0 items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void persist(latestRef.current)}
            className="shrink-0 rounded-full px-2 py-1 font-semibold text-[var(--accent-text)] hover:bg-[var(--surface)]"
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
          className="min-w-0 flex-1 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="เพิ่มรายการ"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </form>

      <ul
        className="mt-3 max-h-[248px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการที่ต้องทำ"
      >
        {notes.length === 0 && (
          <li className="flex min-h-[104px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-3.5 py-5 text-center text-[12.5px] text-[var(--ink-tertiary)]">
            <ListTodo size={20} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>ยังไม่มีรายการ</span>
            <span className="mt-0.5 text-[11px]">พิมพ์รายการด้านบนเพื่อเริ่มต้น</span>
          </li>
        )}

        {notes.map((note) => (
          <li
            key={note.id}
            className="group flex items-center gap-2 rounded-[12px] bg-[var(--surface-grouped)] px-2.5 py-[7px]"
          >
            <button
              type="button"
              onClick={() => toggleNote(note.id)}
              aria-pressed={note.done}
              aria-label={note.done ? `ยกเลิกทำ ${note.text}` : `ทำเสร็จ ${note.text}`}
              className={`relative flex h-[8px] w-[8px] shrink-0 items-center justify-center rounded-full border transition-all duration-150 hover:scale-110 before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-1 ${
                note.done
                  ? 'border-[var(--success)] bg-gradient-to-b from-[var(--success)] to-[#24ab45] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(36,171,69,0.35)]'
                  : 'border-[var(--ink-divider)] bg-gradient-to-b from-white to-[var(--surface-chip-2)] text-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_-1px_2px_rgba(0,0,0,0.07)] hover:border-[var(--accent)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_0_0_3px_rgba(0,102,204,0.10)] active:scale-90'
              }`}
            >
              <Check size={5} strokeWidth={5} aria-hidden="true" />
            </button>

            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                note.done ? 'text-[var(--ink-tertiary)] line-through' : 'text-[var(--ink)]'
              }`}
              title={note.text}
            >
              {note.text}
            </span>

            <button
              type="button"
              onClick={() => removeNote(note.id)}
              aria-label={`ลบ ${note.text}`}
              className="shrink-0 rounded-full p-1 text-[var(--ink-tertiary)] opacity-100 transition-all hover:bg-[var(--surface)] hover:text-[var(--danger)] md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline-soft)] pt-2 text-[10px] text-[var(--ink-secondary)]">
        <span>บันทึกอัตโนมัติ</span>
        <span className="inline-flex items-center gap-1">
          {saving && <Loader2 size={10} className="animate-spin" aria-hidden="true" />}
          {saving ? 'กำลังบันทึก...' : justSaved ? 'บันทึกแล้ว' : `${notes.length}/${MAX_NOTES}`}
        </span>
      </div>
    </section>
  );
}
