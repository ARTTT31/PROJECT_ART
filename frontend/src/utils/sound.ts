'use client';

import { readPreferences } from '@/hooks/usePreferences';

/**
 * A short two-tone chime for new notifications.
 *
 * Synthesised with WebAudio instead of shipping an audio file: no asset request
 * on first notification. Browsers refuse to start an AudioContext before the
 * first user gesture and log "The AudioContext was not allowed to start" for
 * every attempt, so the chime stays silent until one has happened and the
 * context is created only from that point on.
 */
let context: AudioContext | null = null;

let hasUserGesture = false;

if (typeof window !== 'undefined') {
  const markGesture = () => {
    hasUserGesture = true;
  };
  window.addEventListener('pointerdown', markGesture, { once: true, capture: true });
  window.addEventListener('keydown', markGesture, { once: true, capture: true });
}

export function playBellSound(): void {
  if (typeof window === 'undefined') return;
  if (!readPreferences().bellSound) return;
  // A notification that arrives while the page loads (poll, WebSocket, smart
  // alert) cannot play anyway — and asking for a context would only produce the
  // autoplay warning in the console.
  if (!hasUserGesture) return;

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
