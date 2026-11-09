import { describe, expect, it } from 'vitest';
import { describeDevice, type AdminSession } from './ActiveSessionsCard';

function session(overrides: Partial<AdminSession>): AdminSession {
  return {
    id: 1,
    session_id: 'session_1',
    user_id: 1,
    email: 'user@example.com',
    username: null,
    name: 'Test User',
    role: 'user',
    device_label: null,
    user_agent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ip_address: '203.0.113.10',
    is_active: true,
    last_activity: null,
    created_at: null,
    expires_at: null,
    ...overrides,
  };
}

describe('describeDevice', () => {
  it('keeps a specific stored label', () => {
    expect(describeDevice(session({ device_label: 'iPad Pro' }))).toBe('iPad Pro');
  });

  it('replaces a generic label with browser and OS from the user agent', () => {
    expect(describeDevice(session({ device_label: 'Desktop' }))).toBe('Chrome 120 · Windows 10/11');
  });

  it('falls back to the generic label when the user agent is unusable', () => {
    expect(describeDevice(session({ device_label: 'Mobile', user_agent: null }))).toBe('Mobile');
  });
});
