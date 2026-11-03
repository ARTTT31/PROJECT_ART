import { describe, it, expect } from 'vitest';

import {
  isQuickLinkUrl,
  parseQuickLinks,
  quickLinkEnvironmentOptions,
  resolveQuickLinkUrl,
  type QuickLink,
} from './quickLinks';

/**
 * One shortcut can point at several equivalents of the same internal tool. The
 * browser bookmark equivalent is three separate bookmarks (and clicking the
 * wrong one), so these helpers have to be predictable.
 */

describe('isQuickLinkUrl', () => {
  it('accepts absolute http(s) and in-app paths', () => {
    expect(isQuickLinkUrl('https://example.com/hr')).toBe(true);
    expect(isQuickLinkUrl('HTTP://example.com')).toBe(true);
    expect(isQuickLinkUrl('/dashboard')).toBe(true);
  });

  it('rejects other schemes and protocol-relative URLs', () => {
    expect(isQuickLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isQuickLinkUrl('data:text/html,x')).toBe(false);
    expect(isQuickLinkUrl('//evil.example/hr')).toBe(false);
    expect(isQuickLinkUrl('example.com')).toBe(false);
    expect(isQuickLinkUrl('   ')).toBe(false);
  });
});

describe('parseQuickLinks environment variants', () => {
  it('keeps valid alternates and drops invalid ones', () => {
    const raw = JSON.stringify([
      {
        id: 'hr',
        label: 'ระบบ HR',
        url: 'https://hr.example.com',
        icon: 'briefcase',
        envs: { staging: 'https://stg.example.com', development: 'javascript:x' },
      },
    ]);
    expect(parseQuickLinks(raw)[0].envs).toEqual({ staging: 'https://stg.example.com' });
  });

  it('omits the field entirely when nothing is valid', () => {
    const raw = JSON.stringify([
      { id: 'hr', label: 'HR', url: '/hr', icon: 'briefcase', envs: { staging: 'nope' } },
    ]);
    expect(parseQuickLinks(raw)[0].envs).toBeUndefined();
  });

});

describe('environment options', () => {
  const link: QuickLink = {
    id: 'hr',
    label: 'ระบบ HR',
    url: 'https://hr.example.com',
    icon: 'briefcase',
    envs: { staging: 'https://stg.example.com', development: 'https://dev.example.com' },
  };

  it('lists production first, then the alternates', () => {
    expect(quickLinkEnvironmentOptions(link).map((option) => option.key)).toEqual([
      'production',
      'staging',
      'development',
    ]);
    expect(quickLinkEnvironmentOptions(link).map((option) => option.label)).toEqual([
      'PROD',
      'STG',
      'DEV',
    ]);
  });

  it('offers only production for a plain link', () => {
    expect(quickLinkEnvironmentOptions({ ...link, envs: undefined })).toHaveLength(1);
  });

  it('resolves the chosen environment and falls back to production', () => {
    expect(resolveQuickLinkUrl(link, 'staging')).toBe('https://stg.example.com');
    expect(resolveQuickLinkUrl(link, 'production')).toBe('https://hr.example.com');
    expect(resolveQuickLinkUrl(link, 'nonsense')).toBe('https://hr.example.com');
    expect(resolveQuickLinkUrl({ ...link, envs: undefined }, 'staging')).toBe(
      'https://hr.example.com',
    );
  });
});
