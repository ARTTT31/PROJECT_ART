/**
 * Colour palette offered by the quick-link editor.
 *
 * These are stored values, not styling: a link keeps the exact colour its owner
 * picked, so it has to be a concrete hex/serialisable value rather than a CSS
 * custom property (which would resolve differently on every device and theme).
 * Keeping the list in one data module is also what lets the component use
 * tokens for its own surfaces without embedding raw hex in JSX.
 *
 * The defaults mirror the Apple HIG system colours the rest of the app uses.
 */
export const DEFAULT_QUICK_LINK_COLOR = '#0066cc';

export const QUICK_LINK_COLOR_PRESETS = [
  '#0066cc', // Apple Action Blue (accent)
  '#5856d6', // indigo
  '#af52de', // purple
  '#ff2d55', // pink
  '#ff3b30', // red
  '#ff9500', // orange
  '#ffcc00', // yellow
  '#34c759', // green
  '#00c7be', // mint
  '#30b0c7', // teal
  '#8e8e93', // gray
] as const;
