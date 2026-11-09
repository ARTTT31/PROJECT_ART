/**
 * Utility for PWA App Icon Badging (Badging API).
 *
 * Supported on iOS 16.4+ (installed PWA), Android Chrome, Edge/Chrome desktop.
 * Gracefully no-ops on unsupported environments.
 */

export async function setAppBadge(count?: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) {
    return false;
  }

  try {
    if (count !== undefined && count <= 0) {
      await clearAppBadge();
      return true;
    }

    if (count !== undefined) {
      await navigator.setAppBadge(Math.round(count));
    } else {
      await navigator.setAppBadge();
    }
    return true;
  } catch {
    // Badging API can fail if permission is denied or window not focused
    return false;
  }
}

export async function clearAppBadge(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('clearAppBadge' in navigator)) {
    return false;
  }

  try {
    await navigator.clearAppBadge();
    return true;
  } catch {
    return false;
  }
}
