import { describe, expect, it } from 'vitest';

import { resolveProfileLocation } from './profileTab';

describe('resolveProfileLocation', () => {
  it('opens the security section for ?tab=security', () => {
    expect(resolveProfileLocation('?tab=security', '')).toEqual({
      tab: 'profile',
      section: 'security',
    });
  });

  it('accepts the section in the hash and the password alias', () => {
    expect(resolveProfileLocation('', '#security')).toEqual({
      tab: 'profile',
      section: 'security',
    });
    expect(resolveProfileLocation('?tab=password', '')).toEqual({
      tab: 'profile',
      section: 'security',
    });
    expect(resolveProfileLocation('?tab=account', '')).toEqual({
      tab: 'profile',
      section: 'account',
    });
  });

  it('keeps the other tabs and their aliases working', () => {
    expect(resolveProfileLocation('?tab=appearance', '')).toEqual({
      tab: 'appearance',
      section: 'account',
    });
    expect(resolveProfileLocation('?tab=alerts', '')).toEqual({
      tab: 'notifications',
      section: 'account',
    });
    expect(resolveProfileLocation('?tab=admin', '')).toEqual({
      tab: 'workspace',
      section: 'account',
    });
  });

  it('returns null when the link names nothing or something unknown', () => {
    expect(resolveProfileLocation('', '')).toBeNull();
    expect(resolveProfileLocation('?tab=', '')).toBeNull();
    expect(resolveProfileLocation('?tab=billing', '')).toBeNull();
  });
});
