/**
 * Read model for Quick Notes, shared by every card that shows a task count.
 *
 * Quick Notes lives under one offline key (`profile/quick-notes`) that the
 * widget keeps in step with the server. Two other surfaces read it — the daily
 * digest's "สิ่งที่ต้องทำ" tile and the AI Copilot's context — and both used to
 * read a retired `quick_notes_tasks` key instead, so the count never moved when
 * a note was ticked, cleared or deleted. Import from here rather than reading a
 * storage key directly.
 */

import { readCached, readPending } from '@/lib/offline/localStore';

/** Storage name used with `readCached` / `writeCached` (account-scoped there). */
export const QUICK_NOTES_STORAGE_KEY = 'profile/quick-notes';

/** Fired after the widget's list changes, so counters can update without a refetch. */
export const QUICK_NOTES_UPDATED_EVENT = 'art-quick-notes-updated';

export interface QuickNoteSnapshot {
  id: string;
  text: string;
  done: boolean;
}

interface QuickNotesPayload {
  notes?: QuickNoteSnapshot[];
}

/**
 * The list this browser currently knows.
 *
 * A queued offline edit is newer than the cached server copy, so it wins; that
 * keeps the count honest while a save is still waiting for a connection.
 */
export function readQuickNotesSnapshot(): QuickNoteSnapshot[] {
  const pending = readPending<QuickNotesPayload>(QUICK_NOTES_STORAGE_KEY);
  if (pending && Array.isArray(pending.data?.notes)) return pending.data.notes;

  const cached = readCached<QuickNotesPayload>(QUICK_NOTES_STORAGE_KEY);
  return cached && Array.isArray(cached.data?.notes) ? cached.data.notes : [];
}

/** Notes that are still open, in stored order. */
export function pendingQuickNotes(): QuickNoteSnapshot[] {
  return readQuickNotesSnapshot().filter((note) => !note.done);
}

/** Announce a list change to the counters listening on the page. */
export function notifyQuickNotesUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(QUICK_NOTES_UPDATED_EVENT));
}
