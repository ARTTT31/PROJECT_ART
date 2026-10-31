#!/usr/bin/env node
/**
 * One-off codemod: point hard-coded Tailwind colour classes at the theme tokens
 * declared in src/app/globals.css, so the theme card (data-theme / data-accent)
 * can re-colour the whole UI.
 *
 * Usage: node scripts/apply-theme-tokens.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;

// Order matters: the longest / most specific token goes first.
const MAP = [
  // ── accent ────────────────────────────────────────────────────────────────
  ['ring-[#0066cc]/20', 'ring-[var(--accent-ring)]'],
  ['ring-[#0066cc]/25', 'ring-[var(--accent-ring)]'],
  ['ring-[#0066cc]/30', 'ring-[var(--accent-ring)]'],
  ['ring-[#0066cc]/35', 'ring-[var(--accent-border)]'],
  ['ring-[#0066cc]/40', 'ring-[var(--accent-border)]'],
  ['ring-[#0066cc]', 'ring-[var(--accent)]'],
  ['border-[#0066cc]/50', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]/40', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]/30', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]/25', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]/20', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]/15', 'border-[var(--accent-border)]'],
  ['border-[#0066cc]', 'border-[var(--accent)]'],
  ['bg-[#0066cc]/[0.09]', 'bg-[var(--accent-soft)]'],
  ['bg-[#0066cc]/[0.07]', 'bg-[var(--accent-soft)]'],
  ['bg-[#0066cc]/[0.06]', 'bg-[var(--accent-soft)]'],
  ['bg-[#0066cc]/[0.04]', 'bg-[var(--accent-soft-weak)]'],
  ['bg-[#0066cc]/[0.03]', 'bg-[var(--accent-soft-weak)]'],
  ['bg-[#0066cc]/20', 'bg-[var(--accent-soft)]'],
  ['bg-[#0066cc]/10', 'bg-[var(--accent-soft)]'],
  ['bg-[#0066cc]/5', 'bg-[var(--accent-soft-weak)]'],
  ['bg-[#0066cc]', 'bg-[var(--accent)]'],
  ['bg-[#0071e3]', 'bg-[var(--accent-hover)]'],
  ['bg-[#0b63ce]', 'bg-[var(--accent-hover)]'],
  ['via-[#0077ed]', 'via-[var(--accent-hover)]'],
  ['from-[#0066cc]', 'from-[var(--accent)]'],
  ['fill-[#0066cc]', 'fill-[var(--accent)]'],
  ['text-[#0066cc]', 'text-[var(--accent-text)]'],
  ['text-[#0055aa]', 'text-[var(--accent-text)]'],

  // ── ink ───────────────────────────────────────────────────────────────────
  ['text-[#1d1d1f]', 'text-[var(--ink)]'],
  ['text-[#0f172a]', 'text-[var(--ink)]'],
  ['text-[#6e6e73]', 'text-[var(--ink-muted)]'],
  ['text-[#475569]', 'text-[var(--ink-secondary)]'],
  ['text-[#86868b]', 'text-[var(--ink-tertiary)]'],
  ['text-[#8e8e93]', 'text-[var(--ink-tertiary)]'],
  ['text-[#9a9aa0]', 'text-[var(--ink-tertiary)]'],
  ['text-[#a1a1a6]', 'text-[var(--ink-faint)]'],
  ['text-[#c7c7cc]', 'text-[var(--ink-divider)]'],

  // ── semantic ──────────────────────────────────────────────────────────────
  ['text-[#b42318]', 'text-[var(--danger-ink)]'],
  ['text-[#ff3b30]', 'text-[var(--danger)]'],
  ['ring-[#ff3b30]', 'ring-[var(--danger)]'],
  ['bg-[#ff3b30]/[0.07]', 'bg-[var(--danger-soft)]'],
  ['bg-[#ff3b30]/[0.06]', 'bg-[var(--danger-soft)]'],
  ['bg-[#ff3b30]/10', 'bg-[var(--danger-soft)]'],
  ['bg-[#ff3b30]', 'bg-[var(--danger)]'],
  ['border-[#ff3b30]/15', 'border-[var(--danger-soft)]'],
  ['text-[#248a3d]', 'text-[var(--success-ink)]'],
  ['text-[#1f9d45]', 'text-[var(--success-ink)]'],
  ['text-[#34c759]', 'text-[var(--success)]'],
  ['bg-[#34c759]/12', 'bg-[var(--success-soft)]'],
  ['bg-[#34c759]/10', 'bg-[var(--success-soft)]'],
  ['bg-[#34c759]', 'bg-[var(--success)]'],
  ['border-[#29a84a]', 'border-[var(--success)]'],
  ['from-[#4cd964]', 'from-[var(--success)]'],
  ['text-[#c77700]', 'text-[var(--warning-ink)]'],
  ['text-[#8a4b00]', 'text-[var(--warning-ink)]'],
  ['bg-[#c77700]/10', 'bg-[var(--warning-soft)]'],
  ['bg-[#ff9500]/10', 'bg-[var(--warning-soft)]'],
  ['bg-[#ff9500]', 'bg-[var(--warning)]'],
  ['text-[#ff9500]', 'text-[var(--warning)]'],
  ['text-[#5856d6]', 'text-[var(--info-ink)]'],
  ['text-[#4b49bd]', 'text-[var(--info-ink)]'],
  ['ring-[#5856d6]/15', 'ring-[var(--info-soft)]'],
  ['bg-[#5856d6]/10', 'bg-[var(--info-soft)]'],
  ['bg-[#30b0c7]/10', 'bg-[var(--info-soft)]'],

  // ── surfaces ──────────────────────────────────────────────────────────────
  ['bg-[#f5f5f7]/70', 'bg-[var(--surface-grouped)]'],
  ['bg-[#f5f5f7]/60', 'bg-[var(--surface-grouped)]'],
  ['bg-[#f5f5f7]', 'bg-[var(--surface-grouped)]'],
  ['border-[#f5f5f7]', 'border-[var(--surface-grouped)]'],
  ['bg-[#f2f2f7]/60', 'bg-[var(--surface-grouped-2)]'],
  ['bg-[#f2f2f7]', 'bg-[var(--surface-grouped-2)]'],
  ['bg-[#f8fafc]', 'bg-[var(--surface-subtle)]'],
  ['bg-[#f8f8fa]', 'bg-[var(--surface-subtle)]'],
  ['bg-[#fbfbfc]', 'bg-[var(--surface-subtle)]'],
  ['bg-[#fbfbfd]', 'bg-[var(--surface-subtle)]'],
  ['bg-[#fafafc]', 'bg-[var(--surface-subtle)]'],
  ['from-[#fbfbfd]', 'from-[var(--surface-subtle)]'],
  ['to-[#f4f4f6]', 'to-[var(--surface-grouped-2)]'],
  ['to-[#edeef1]', 'to-[var(--surface-chip-2)]'],
  ['bg-[#e5e5ea]', 'bg-[var(--surface-chip)]'],
  ['bg-[#e8e8ed]', 'bg-[var(--surface-chip-2)]'],
  ['bg-[#ececf0]', 'bg-[var(--surface-chip-2)]'],
  ['bg-[#f0f0f3]', 'bg-[var(--surface-chip)]'],
  ['bg-[#eaebee]/80', 'bg-[var(--surface-chip)]'],
  ['bg-[#eaebee]', 'bg-[var(--surface-chip)]'],
  ['bg-[#e9e9ee]/90', 'bg-[var(--surface-chip)]'],
  ['bg-[#dedee4]', 'bg-[var(--surface-chip-2)]'],
  ['border-[#c9c9ce]', 'border-[var(--ink-divider)]'],
  ['bg-[#1d1d1f]', 'bg-[var(--ink)]'],
  ['ring-[#1d1d1f]', 'ring-[var(--ink)]'],

  // ── white surfaces / glass ────────────────────────────────────────────────
  ['bg-white/95', 'bg-[var(--glass-95)]'],
  ['bg-white/90', 'bg-[var(--glass-95)]'],
  ['bg-white/80', 'bg-[var(--glass-80)]'],
  ['bg-white/70', 'bg-[var(--glass-80)]'],
  ['bg-white/60', 'bg-[var(--glass-60)]'],
  ['bg-white/50', 'bg-[var(--glass-60)]'],
  ['bg-white/40', 'bg-[var(--glass-40)]'],
  ['bg-white/30', 'bg-[var(--glass-40)]'],
  ['bg-white/20', 'bg-[var(--glass-20)]'],
  ['bg-white/18', 'bg-[var(--glass-20)]'],
  ['bg-white/10', 'bg-[var(--glass-10)]'],
  ['bg-white', 'bg-[var(--surface)]'],

  // ── hairlines ─────────────────────────────────────────────────────────────
  ['border-black/[0.16]', 'border-[var(--hairline-strong)]'],
  ['border-black/[0.09]', 'border-[var(--hairline)]'],
  ['border-black/[0.08]', 'border-[var(--hairline)]'],
  ['border-black/[0.06]', 'border-[var(--hairline)]'],
  ['border-black/[0.05]', 'border-[var(--hairline-soft)]'],
  ['border-black/[0.04]', 'border-[var(--hairline-soft)]'],
  ['border-black/10', 'border-[var(--hairline-strong)]'],
  ['ring-black/[0.08]', 'ring-[var(--hairline)]'],
  ['ring-black/[0.06]', 'ring-[var(--hairline)]'],
  ['ring-black/10', 'ring-[var(--hairline-strong)]'],
  ['divide-black/[0.06]', 'divide-[var(--hairline)]'],
  ['divide-black/[0.08]', 'divide-[var(--hairline)]'],
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(ROOT).filter((path) => ['.ts', '.tsx', '.css'].includes(extname(path)));
let touched = 0;
const unknown = new Map();

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let next = original;
  for (const [from, to] of MAP) next = next.split(from).join(to);
  if (next !== original) {
    writeFileSync(file, next, 'utf8');
    touched += 1;
  }
  for (const token of next.match(/(?:bg|text|border|ring|from|to|via|fill|divide)-\$?#[0-9a-fA-F]{3,8}/g) ?? []) {
    unknown.set(token, (unknown.get(token) ?? 0) + 1);
  }
}

console.log(`updated ${touched}/${files.length} files`);
if (unknown.size) {
  console.log('remaining hard-coded colour utilities:');
  for (const [token, count] of [...unknown].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count} × ${token}`);
  }
}
