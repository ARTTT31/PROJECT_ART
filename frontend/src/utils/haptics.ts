/**
 * Apple-style Haptic Feedback Utility for Mobile & PWA.
 *
 * Uses the Web Vibration API (navigator.vibrate) with micro-pulses
 * calibrated to match Apple HIG physical feedback.
 * Gracefully no-ops in unsupported browsers or desktop environments.
 */

export function triggerHaptic(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Light tap (8-10ms) for switches, tab switches, and button presses.
 */
export function hapticTap(): boolean {
  return triggerHaptic(10);
}

/**
 * Success feedback ([12ms, 40ms, 12ms]) for completing tasks, saving forms, export.
 */
export function hapticSuccess(): boolean {
  return triggerHaptic([12, 40, 12]);
}

/**
 * Warning feedback ([30ms, 50ms, 30ms]) for destructive actions, validation errors.
 */
export function hapticWarning(): boolean {
  return triggerHaptic([30, 50, 30]);
}

/**
 * React hook wrapper for haptics.
 */
export function useHaptics() {
  return {
    tap: hapticTap,
    success: hapticSuccess,
    warning: hapticWarning,
  };
}
