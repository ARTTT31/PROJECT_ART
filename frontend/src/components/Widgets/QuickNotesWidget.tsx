'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ListTodo, Loader2, Plus, Trash2 } from 'lucide-react';
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

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function QuickNotesWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<QuickNote[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/v1/profile/quick-notes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NotesResponse;
      const loaded = Array.isArray(data.notes) ? data.notes : [];
      latestRef.current = loaded;
      setNotes(loaded);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      abortRef.current?.abort();
    };
  }, [load]);

  const persist = useCallback(async (next: QuickNote[]) => {
    setSaving(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetchWithAuth('/api/v1/profile/quick-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: next }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = (body as { detail?: unknown })?.detail;
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`);
      }
      setError(null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      // Keep the optimistic list: the items are still on screen, and the next
      // edit retries the whole list (the endpoint replaces it wholesale).
      setError('บันทึกไม่สำเร็จ ลองแก้อีกครั้ง');
    } finally {
      setSaving(false);
    }
  }, []);

  /** Apply a change locally, then save it after the user stops typing. */
  const update = useCallback(
    (next: QuickNote[]) => {
      latestRef.current = next;
      setNotes(next);
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
        className="flex min-h-[300px] items-center justify-center rounded-[18px] border border-black/[0.06] bg-white p-5"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดโน้ตด่วน"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#0066cc]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5"
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
        <div className="mt-3 flex items-center justify-between gap-2 rounded-[12px] bg-[#ff3b30]/10 px-3 py-2 text-[12px] font-medium text-[#ff3b30]">
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => void persist(latestRef.current)}
            className="shrink-0 font-bold underline"
          >
            ลองใหม่
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

      <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5" aria-label="รายการที่ต้องทำ">
        {notes.length === 0 && (
          <li className="rounded-[14px] bg-[#f5f5f7] px-3.5 py-6 text-center text-[12.5px] text-[#86868b]">
            ยังไม่มีรายการ — พิมพ์ด้านบนเพื่อเริ่มต้น
          </li>
        )}

        {notes.map((note) => (
          <li
            key={note.id}
            className="group flex items-center gap-2.5 rounded-[14px] bg-[#f5f5f7] px-3 py-2"
          >
            <button
              type="button"
              onClick={() => toggleNote(note.id)}
              aria-pressed={note.done}
              aria-label={note.done ? `ยกเลิกทำ ${note.text}` : `ทำเสร็จ ${note.text}`}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                note.done
                  ? 'border-[#34c759] bg-[#34c759] text-white'
                  : 'border-black/15 bg-white text-transparent hover:border-[#0066cc]'
              }`}
            >
              <Check size={12} aria-hidden="true" />
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
