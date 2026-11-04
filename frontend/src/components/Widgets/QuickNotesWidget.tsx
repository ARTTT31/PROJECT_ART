'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ListTodo, Loader2, Plus, RotateCw, Trash2 } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  clearPending,
  isOffline,
  readCached,
  readPending,
  writeCached,
  writePending,
} from '@/lib/offline/localStore';
import { useOnlineStatus } from '@/lib/offline/useOnlineStatus';
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

const NOTES_OFFLINE_KEY = 'profile/quick-notes';

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
  if (notesCache && notesCache.userId === currentUserId()) return notesCache.notes;
  // The module cache is empty on a fresh page load; localStorage is what keeps
  // the list readable when the page is opened without a connection.
  const cached = readCached<NotesResponse>(NOTES_OFFLINE_KEY);
  return cached && Array.isArray(cached.data.notes) ? cached.data.notes : null;
}

function writeNotesCache(notes: QuickNote[]) {
  notesCache = { userId: currentUserId(), notes };
  writeCached<NotesResponse>(NOTES_OFFLINE_KEY, { notes });
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
  const [pendingSync, setPendingSync] = useState(() => readPending(NOTES_OFFLINE_KEY) !== null);
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Inline rename. A note could previously only be added or deleted, so fixing a
  // typo meant deleting the line and retyping it.
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

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
    if (isOffline()) {
      setLoading(false);
      return;
    }
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
      // An offline edit may still be waiting to be saved; the older server copy
      // must not replace it before the flush.
      if (readPending(NOTES_OFFLINE_KEY)) {
        setPendingSync(true);
        return;
      }
      const loaded = Array.isArray(data.notes) ? data.notes : [];
      writeNotesCache(loaded);
      latestRef.current = loaded;
      setNotes(loaded);
      setPendingSync(false);
    } catch (err) {
      // With a cached list the widget stays usable offline; only a first load
      // with nothing stored shows the full error card.
      if (readNotesCache() === null) {
        setLoadError(`โหลดรายการไม่สำเร็จ: ${requestErrorMessage(err)}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = useCallback((next: QuickNote[]) => {
    const sequence = ++saveSequenceRef.current;
    // Save locally first: an offline edit must survive a reload, and this
    // snapshot is replayed once the connection is back.
    writeNotesCache(next);
    writePending(NOTES_OFFLINE_KEY, { notes: next });
    setSaving(true);
    setPendingSync(true);

    // Do not abort a write that may already have reached the database. Queue
    // snapshots in order so a slower earlier request cannot overwrite newer edits.
    const save = async () => {
      try {
        // No request while offline: the snapshot waits for the `online` event.
        if (isOffline()) return;
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
          clearPending(NOTES_OFFLINE_KEY);
          writeNotesCache(next);
          setPendingSync(false);
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

  // Replay an edit queued while offline (here or in a previous session) as soon
  // as the connection is back.
  useEffect(() => {
    const flush = () => {
      if (!readPending(NOTES_OFFLINE_KEY)) return;
      void persist(latestRef.current);
    };
    if (!isOffline()) flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [persist]);

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
    // Keep the caret in the field: adding several items in a row should never
    // need a click back into the input.
    draftInputRef.current?.focus();
  };

  const toggleNote = (id: string) => {
    update(
      latestRef.current.map((note) => (note.id === id ? { ...note, done: !note.done } : note)),
    );
  };

  const removeNote = (id: string) => {
    if (editing?.id === id) setEditing(null);
    update(latestRef.current.filter((note) => note.id !== id));
  };

  const startEdit = (note: QuickNote) => {
    setEditing({ id: note.id, text: note.text });
  };

  const commitEdit = () => {
    if (!editing) return;
    const text = editing.text.trim().slice(0, MAX_NOTE_LENGTH);
    const current = latestRef.current.find((note) => note.id === editing.id);
    setEditing(null);
    // Empty input means "never mind", not "delete my line".
    if (text && current && text !== current.text) {
      update(latestRef.current.map((note) => (note.id === editing.id ? { ...note, text } : note)));
    }
  };

  const clearCompleted = () => {
    const kept = latestRef.current.filter((note) => !note.done);
    if (kept.length !== latestRef.current.length) update(kept);
  };

  /** Move the caret/cursor to the end of a note when its editor opens. */
  const focusEditInput = (element: HTMLInputElement | null) => {
    editInputRef.current = element;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  };

  const remaining = notes.filter((note) => !note.done).length;
  const completed = notes.length - remaining;

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
      className="flex h-full flex-col justify-start rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
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
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--ink-tertiary)]">
              <span className="truncate">
                {notes.length === 0
                  ? 'เพิ่มรายการที่ต้องทำวันนี้'
                  : remaining > 0
                    ? `เหลืออีก ${remaining} รายการ`
                    : 'ทำครบทุกอย่างแล้ว 🎉'}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--ink-secondary)]">
                {notes.length}/{MAX_NOTES}
              </span>
              {saving && (
                <Loader2 size={10} className="shrink-0 animate-spin text-[var(--accent)]" aria-hidden="true" />
              )}
              {!saving && !justSaved && pendingSync && (
                <span className="shrink-0 font-medium text-[var(--ink-secondary)]">
                  {online ? 'รอซิงก์' : 'บันทึกในเครื่องแล้ว'}
                </span>
              )}
              {!saving && justSaved && (
                <span className="shrink-0 font-medium text-[var(--success)]">บันทึกแล้ว</span>
              )}
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
          ref={draftInputRef}
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

      {completed > 0 && (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={clearCompleted}
            className="rounded-full px-2 py-[3px] text-[10px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)]/10"
          >
            ล้างที่เสร็จแล้ว ({completed})
          </button>
        </div>
      )}

      <ul
        className="mt-2 max-h-[268px] space-y-1.5 overflow-y-auto pr-0.5"
        aria-label="รายการที่ต้องทำ"
      >
        {notes.length === 0 && (
          <li className="flex min-h-[104px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-3.5 py-5 text-center text-[12.5px] text-[var(--ink-tertiary)]">
            <ListTodo size={20} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>ยังไม่มีรายการ</span>
            <span className="mt-0.5 text-[11px]">พิมพ์รายการด้านบนเพื่อเริ่มต้น</span>
          </li>
        )}

        {notes.map((note) => {
          const isEditing = editing?.id === note.id;
          return (
            <li
              key={note.id}
              className={`group flex items-center gap-2 rounded-[12px] px-2 py-1.5 transition-colors ${
                note.done ? 'bg-[var(--surface-subtle)]' : 'bg-[var(--surface-grouped)] hover:bg-[var(--surface-chip)]'
              }`}
            >
              {/* A 20px iOS-style box with the tick drawn on: the old control was
                  an 8px circle whose icon was invisible in practice, and its
                  real tap target was smaller than a fingertip. */}
              <button
                type="button"
                onClick={() => toggleNote(note.id)}
                aria-pressed={note.done}
                aria-label={note.done ? `ยกเลิกทำ ${note.text}` : `ทำเสร็จ ${note.text}`}
                className="-m-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
              >
                <span
                  className={`flex h-[20px] w-[20px] items-center justify-center rounded-[7px] border-[1.5px] transition-all duration-200 ${
                    note.done
                      ? 'border-[var(--success)] bg-gradient-to-b from-[var(--success)] to-[#22a447] shadow-[0_1px_3px_rgba(34,164,71,0.45)]'
                      : 'border-[var(--ink-divider)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)]/5'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[13px] w-[13px]"
                    fill="none"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 13.5 9.5 18 19 6.5"
                      style={{
                        stroke: note.done ? '#ffffff' : 'transparent',
                        strokeDasharray: 26,
                        strokeDashoffset: note.done ? 0 : 26,
                        transition: 'stroke-dashoffset 200ms ease-out, stroke 120ms linear',
                      }}
                    />
                  </svg>
                </span>
              </button>

              {isEditing ? (
                <input
                  ref={focusEditInput}
                  type="text"
                  value={editing.text}
                  onChange={(event) => setEditing({ id: editing.id, text: event.target.value })}
                  onBlur={commitEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitEdit();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEditing(null);
                    }
                  }}
                  maxLength={MAX_NOTE_LENGTH}
                  aria-label={`แก้ไข ${note.text}`}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] px-2 py-[3px] text-[13px] text-[var(--ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(note)}
                  aria-label={`แก้ไข ${note.text}`}
                  title="คลิกเพื่อแก้ไข"
                  className="min-w-0 flex-1 rounded-md px-0.5 py-[3px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                >
                  <span
                    className={`block break-words text-[13px] leading-snug ${
                      note.done ? 'text-[var(--ink-tertiary)] line-through' : 'text-[var(--ink)]'
                    }`}
                  >
                    {note.text}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => removeNote(note.id)}
                aria-label={`ลบ ${note.text}`}
                className="shrink-0 rounded-full p-1.5 text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface)] hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
