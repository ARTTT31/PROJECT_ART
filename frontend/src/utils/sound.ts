'use client';

import { readPreferences } from '@/hooks/usePreferences';

/**
 * A short two-tone chime for new notifications.
 *
 * Synthesised with WebAudio instead of shipping an audio file: no asset request
 * on first notification and no autoplay policy surprises beyond the browser's
 * own user-gesture rule (which the catch below tolerates).
 */
let context: AudioContext | null = null;

export function playBellSound(): void {
  if (typeof window === 'undefined') return;
  if (!readPreferences().bellSound) return;

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    context = context ?? new Ctor();
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.27);
  } catch {
    // Autoplay blocked: the badge still updates, the sound is optional.
  }
}
