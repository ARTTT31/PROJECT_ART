'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Timer as TimerIcon,
  CheckCircle2,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface ModeConfig {
  label: string;
  duration: number; // in seconds
  tag: string;
}

const MODES: Record<TimerMode, ModeConfig> = {
  focus: { label: 'โฟกัส', duration: 25 * 60, tag: '25 นาที' },
  shortBreak: { label: 'พักสั้น', duration: 5 * 60, tag: '5 นาที' },
  longBreak: { label: 'พักยาว', duration: 15 * 60, tag: '15 นาที' },
};

function playGentleChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Dual-tone harmonic chime (D5 -> A5 -> D6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.9);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.45);
    gain2.gain.setValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.2);
  } catch {
    // Audio context unavailable or blocked by browser policy
  }
}

export default function FocusTimerWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(MODES.focus.duration);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const activeDuration = MODES[mode].duration;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch mode handler
  const handleModeChange = useCallback(
    (newMode: TimerMode) => {
      setIsRunning(false);
      setMode(newMode);
      setTimeLeft(MODES[newMode].duration);
    },
    [],
  );

  // Timer interval effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            if (soundEnabled) {
              playGentleChime();
            }
            if (mode === 'focus') {
              setCompletedSessions((s) => s + 1);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, soundEnabled]);

  // Reset timer handler
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(MODES[mode].duration);
  }, [mode]);

  // Toggle running handler
  const handleTogglePlay = useCallback(() => {
    if (timeLeft === 0) {
      setTimeLeft(MODES[mode].duration);
    }
    setIsRunning((r) => !r);
  }, [mode, timeLeft]);

  // Format time MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Circular progress calculation
  const progress = activeDuration > 0 ? (activeDuration - timeLeft) / activeDuration : 0;
  const circleRadius = 42;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeOffset = circumference - progress * circumference;

  return (
    <div
      data-testid="focus-timer-widget"
      className="flex h-full min-h-[220px] flex-col justify-between rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5 transition-colors"
    >
      {/* Top Bar: Title & Resize / Sound */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[11px] bg-[var(--surface-chip)] text-[var(--accent)]">
            <TimerIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)]">โฟกัส & จับเวลา</h3>
            {width === 1 && (
              <p className="text-[11px] text-[var(--ink-muted)]">{MODES[mode].label}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-label={soundEnabled ? 'ปิดเสียงเตือน' : 'เปิดเสียงเตือน'}
            title={soundEnabled ? 'ปิดเสียงเตือน' : 'เปิดเสียงเตือน'}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] transition-colors active:scale-[0.95]"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </button>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} />}
        </div>
      </div>

      {/* Middle Content */}
      <div className="my-auto py-2">
        {width === 1 ? (
          /* Size S: Compact Ring & Controls */
          <div className="flex flex-col items-center gap-2.5">
            {/* Mode mini pill */}
            <div className="inline-flex rounded-full bg-[var(--surface-chip)] p-0.5 text-[11px]">
              {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  className={`rounded-full px-2 py-0.5 font-medium transition-all duration-150 active:scale-[0.95] ${
                    mode === m
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {MODES[m].label}
                </button>
              ))}
            </div>

            {/* Countdown digits with mini circular progress */}
            <div className="relative flex items-center justify-center">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  className="stroke-[var(--hairline)]"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  className="stroke-[var(--accent)] transition-all duration-300 ease-linear"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-2xl font-bold tracking-tight text-[var(--ink)]">
                  {formattedTime}
                </span>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {isRunning ? 'กำลังทำงาน' : timeLeft === 0 ? 'เสร็จสิ้น' : 'หยุดชั่วคราว'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isRunning ? 'หยุดชั่วคราว' : 'เริ่มจับเวลา'}
                className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-xs transition-transform active:scale-[0.95] hover:opacity-95"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>พัก</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>เริ่ม</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                aria-label="รีเซ็ตเวลา"
                title="รีเซ็ตเวลา"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-chip)] text-[var(--ink-secondary)] transition-transform hover:text-[var(--ink)] active:scale-[0.95]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : width === 2 ? (
          /* Size M: Two Column / Mode Selector & Timer */
          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            {/* Left: Mode Tabs & Info */}
            <div className="flex flex-col gap-3">
              <div className="inline-flex rounded-full bg-[var(--surface-chip)] p-1 text-xs">
                {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={`flex-1 rounded-full py-1 text-center font-medium transition-all duration-150 active:scale-[0.95] ${
                      mode === m
                        ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {MODES[m].label}
                  </button>
                ))}
              </div>

              <div className="rounded-[11px] border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3">
                <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
                  <span>เป้าหมายรอบวันนี้</span>
                  <span className="font-semibold text-[var(--ink)]">
                    {completedSessions} รอบ
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((dot) => (
                    <div
                      key={dot}
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        dot < completedSessions % 4 || completedSessions >= 4
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--surface-chip)]'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
                  ครบ 4 รอบโฟกัส แนะนำให้พักยาว 15 นาที
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isRunning ? 'หยุดชั่วคราว' : 'เริ่มจับเวลา'}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-xs transition-transform active:scale-[0.95] hover:opacity-95"
                >
                  {isRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      <span>หยุดชั่วคราว</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>เริ่มโฟกัส</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="รีเซ็ตเวลา"
                  className="flex h-9 items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-chip)] px-3 text-xs font-medium text-[var(--ink-secondary)] transition-transform hover:text-[var(--ink)] active:scale-[0.95]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>รีเซ็ต</span>
                </button>
              </div>
            </div>

            {/* Right: Circular Timer */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center">
                <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    className="stroke-[var(--hairline)]"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    className="stroke-[var(--accent)] transition-all duration-300 ease-linear"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-3xl font-bold tracking-tight text-[var(--ink)]">
                    {formattedTime}
                  </span>
                  <span className="text-xs font-medium text-[var(--ink-muted)]">
                    {MODES[mode].label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Size L: Full 3-Column View with Analytics & Tips */
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            {/* Mode & Timer */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex items-center justify-center">
                <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    className="stroke-[var(--hairline)]"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    className="stroke-[var(--accent)] transition-all duration-300 ease-linear"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-3xl font-bold tracking-tight text-[var(--ink)]">
                    {formattedTime}
                  </span>
                  <span className="text-xs font-medium text-[var(--ink-muted)]">
                    {MODES[mode].label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-white transition-transform active:scale-[0.95]"
                >
                  {isRunning ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                  <span>{isRunning ? 'หยุดชั่วคราว' : 'เริ่ม'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-chip)] text-[var(--ink-secondary)] active:scale-[0.95]"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[var(--ink)]">เลือกโหมดการทำงาน</span>
              {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  className={`flex items-center justify-between rounded-[11px] border p-2.5 text-xs font-medium transition-all active:scale-[0.95] ${
                    mode === m
                      ? 'border-[var(--accent)] bg-[var(--surface-grouped)] text-[var(--accent)]'
                      : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{MODES[m].label}</span>
                  <span className="text-[11px] text-[var(--ink-muted)]">{MODES[m].tag}</span>
                </button>
              ))}
            </div>

            {/* Stats and Productivity Tips */}
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>สรุปผลผลิตวันนี้</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--ink-secondary)]">รอบที่เสร็จสมบูรณ์</span>
                <span className="font-semibold text-[var(--ink)]">{completedSessions} รอบ</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--ink-secondary)]">เวลาโฟกัสสะสม</span>
                <span className="font-semibold text-[var(--ink)]">{completedSessions * 25} นาที</span>
              </div>
              <div className="mt-1 flex items-start gap-1.5 rounded-[11px] bg-[var(--surface)] p-2 text-[11px] text-[var(--ink-muted)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>เทคนิค Pomodoro ช่วยลดความล้าของสมองและเพิ่มความต่อเนื่องในการทำงาน</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Subtle Status */}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-2 text-[11px] text-[var(--ink-muted)]">
        <span>รอบที่สำเร็จ: {completedSessions}</span>
        <span>{soundEnabled ? '🔔 เสียงเปิด' : '🔕 เสียงปิด'}</span>
      </div>
    </div>
  );
}
