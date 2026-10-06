import { describe, it, expect } from 'vitest'

import { cn } from './utils'

/**
 * `cn` is how component class overrides win over their defaults. If the merge
 * stops de-duplicating Tailwind conflicts, callers silently get whichever class
 * the browser applies last instead of the one the caller passed — a styling bug
 * that is hard to trace back to this helper.
 */

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })

  it('ignores falsy values', () => {
    expect(cn('flex', undefined, null, false, '', 'gap-2')).toBe('flex gap-2')
  })

  it('supports the clsx object and array forms', () => {
    expect(cn({ hidden: true, block: false })).toBe('hidden')
    expect(cn(['flex', 'gap-2'])).toBe('flex gap-2')
  })

  it('lets a later class win over the conflicting earlier one', () => {
    const merged = cn('px-2 py-1', 'px-4')

    expect(merged).toContain('px-4')
    expect(merged).not.toContain('px-2')
    expect(merged).toContain('py-1')
  })

  it('keeps classes that do not actually conflict', () => {
    const merged = cn('text-sm text-[#6e6e73]', 'font-bold')

    expect(merged).toContain('text-sm')
    expect(merged).toContain('font-bold')
  })
})
