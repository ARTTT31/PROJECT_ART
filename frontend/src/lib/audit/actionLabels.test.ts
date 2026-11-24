import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTION_LABELS } from './actionLabels';

/**
 * The backend writes audit actions as `action="SOME_ACTION"` literals in its
 * endpoints. Nothing links that string to the /audit page, so an action added
 * on the server would silently render as its raw key (and be missing from the
 * filter). This test reads those literals and fails when one has no label.
 */
function backendApp(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = resolve(dir, 'backend', 'app');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return resolve(process.cwd(), 'backend', 'app');
}

const BACKEND_APP = backendApp();

/** action → the backend files that write it. */
function backendAuditActions(): Map<string, string[]> {
  const actions = new Map<string, string[]>();
  const files = readdirSync(BACKEND_APP, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.py'))
    .map((entry) => entry.split('\\').join('/'));

  for (const relative of files) {
    const source = readFileSync(`${BACKEND_APP}/${relative}`, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const call = /action\s*=\s*(.+)$/.exec(line);
      if (!call) continue;
      // One call can choose between actions: `action="LOGOUT" if own else "…"`.
      for (const match of call[1].matchAll(/"([A-Z0-9_]{3,})"/g)) {
        const action = match[1];
        actions.set(action, [...(actions.get(action) ?? []), relative]);
      }
    }
  }
  return actions;
}

describe('/audit action labels', () => {
  it('can read the backend endpoints', () => {
    expect(existsSync(BACKEND_APP), `backend not found at ${BACKEND_APP}`).toBe(true);
    expect(backendAuditActions().size).toBeGreaterThanOrEqual(30);
  });

  it('labels every action the backend writes to audit_logs', () => {
    const unlabeled = [...backendAuditActions()]
      .filter(([action]) => !(action in ACTION_LABELS))
      .map(([action, files]) => `${action} (${files.join(', ')})`);

    expect(unlabeled, 'Add a label in frontend/src/lib/audit/actionLabels.ts').toEqual([]);
  });

  it('gives every label a Thai and an English text', () => {
    const empty = Object.entries(ACTION_LABELS)
      .filter(([, label]) => !label.th.trim() || !label.en.trim())
      .map(([action]) => action);

    expect(empty).toEqual([]);
  });
});
