import { describe, expect, it } from 'vitest';
import { auditExportFilename } from './exportFilename';

describe('auditExportFilename', () => {
  it('carries the full date range both ends', () => {
    expect(auditExportFilename('2026-11-01', '2026-11-24')).toBe(
      'audit-log_2026-11-01_to_2026-11-24.csv',
    );
  });

  it('keeps a one-sided filter one-sided', () => {
    expect(auditExportFilename('2026-11-01', '')).toBe('audit-log_from_2026-11-01.csv');
    expect(auditExportFilename('', '2026-11-24')).toBe('audit-log_until_2026-11-24.csv');
  });

  it('dates an unfiltered export so two files never share a name', () => {
    expect(auditExportFilename('', '', new Date(2026, 10, 24))).toBe('audit-log_all_2026-11-24.csv');
    expect(auditExportFilename('', '', new Date(2026, 0, 5))).toBe('audit-log_all_2026-01-05.csv');
  });
});
