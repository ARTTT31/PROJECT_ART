import type { WidgetWidth } from '@/types';

/**
 * Column span for a dashboard tile.
 *
 * Kept as a pure function so the breakpoints are a contract a test can pin: the
 * mapping is the whole point of the fix that moved half-width tiles from `md` to
 * `lg`. At `md` a half tile was ~340px, which squeezed the charts into slivers.
 */
export function widgetColSpan(width: WidgetWidth | number): string {
  if (width === 3) return 'col-span-full';
  if (width === 2) return 'col-span-full lg:col-span-8';
  return 'col-span-full lg:col-span-6';
}
