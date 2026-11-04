import { describe, expect, it } from 'vitest';
import { MENU_LABEL_KEYS, messages, type MessageKey } from './messages';

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('i18n messages', () => {
  it('defines the same keys in Thai and English', () => {
    const thai = Object.keys(messages.th).sort();
    const english = Object.keys(messages.en).sort();
    expect(english).toEqual(thai);
  });

  it('has no empty strings', () => {
    (Object.keys(messages.th) as MessageKey[]).forEach((key) => {
      expect(messages.th[key].trim(), `th:${key}`).not.toBe('');
      expect(messages.en[key].trim(), `en:${key}`).not.toBe('');
    });
  });

  it('uses the same placeholders in both languages', () => {
    (Object.keys(messages.th) as MessageKey[]).forEach((key) => {
      expect(placeholders(messages.en[key]), key).toEqual(placeholders(messages.th[key]));
    });
  });

  it('maps every main-menu page to an existing label key', () => {
    Object.values(MENU_LABEL_KEYS).forEach((key) => {
      expect(messages.th[key]).toBeTruthy();
    });
  });
});
