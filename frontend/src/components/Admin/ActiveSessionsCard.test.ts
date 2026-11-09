import { describe, expect, it } from 'vitest';
import { describeDevice } from '@/utils/userAgent';

const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('describeDevice', () => {
  it('keeps a specific stored label', () => {
    expect(describeDevice(WINDOWS_CHROME, 'iPad Pro')).toBe('iPad Pro');
  });

  it('replaces a generic label with browser and OS from the user agent', () => {
    expect(describeDevice(WINDOWS_CHROME, 'Desktop')).toBe('Chrome 120 · Windows 10/11');
  });

  it('falls back to the generic label when the user agent is unusable', () => {
    expect(describeDevice(null, 'Mobile')).toBe('Mobile');
  });

  it('says so when nothing identifies the device', () => {
    expect(describeDevice(null, null)).toBe('ไม่ระบุอุปกรณ์');
  });
});
