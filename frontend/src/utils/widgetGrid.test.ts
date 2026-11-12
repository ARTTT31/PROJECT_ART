import { describe, expect, it } from 'vitest';

import { widgetColSpan } from './widgetGrid';

describe('widgetColSpan', () => {
  it('gives a large tile the full row at every width', () => {
    expect(widgetColSpan(3)).toBe('col-span-full');
  });

  it('holds a medium tile full-width until lg, then two thirds', () => {
    expect(widgetColSpan(2)).toBe('col-span-full lg:col-span-8');
  });

  it('holds a small tile full-width until lg, then half', () => {
    expect(widgetColSpan(1)).toBe('col-span-full lg:col-span-6');
  });

  it('never uses the md breakpoint, which squeezed a half tile to ~340px', () => {
    for (const width of [1, 2, 3] as const) {
      expect(widgetColSpan(width)).not.toContain('md:');
    }
  });
});
