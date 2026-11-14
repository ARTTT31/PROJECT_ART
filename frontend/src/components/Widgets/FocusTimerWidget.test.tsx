import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FocusTimerWidget from './FocusTimerWidget';

describe('FocusTimerWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders with 25:00 default countdown in focus mode', () => {
    render(<FocusTimerWidget width={1} />);
    expect(screen.getByText('โฟกัส & จับเวลา')).toBeDefined();
    expect(screen.getByText('25:00')).toBeDefined();
    expect(screen.getByText('เริ่ม')).toBeDefined();
  });

  it('switches modes and updates countdown accordingly', () => {
    render(<FocusTimerWidget width={1} />);
    
    // Switch to short break (5m)
    const shortBreakBtn = screen.getByRole('button', { name: 'พักสั้น' });
    fireEvent.click(shortBreakBtn);
    expect(screen.getByText('05:00')).toBeDefined();

    // Switch to long break (15m)
    const longBreakBtn = screen.getByRole('button', { name: 'พักยาว' });
    fireEvent.click(longBreakBtn);
    expect(screen.getByText('15:00')).toBeDefined();

    // Switch back to focus (25m)
    const focusBtn = screen.getByRole('button', { name: 'โฟกัส' });
    fireEvent.click(focusBtn);
    expect(screen.getByText('25:00')).toBeDefined();
  });

  it('starts, counts down, pauses, and resets timer', () => {
    render(<FocusTimerWidget width={1} />);
    
    const playBtn = screen.getByRole('button', { name: 'เริ่มจับเวลา' });
    fireEvent.click(playBtn);

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('24:57')).toBeDefined();
    expect(screen.getByText('พัก')).toBeDefined();

    // Pause
    const pauseBtn = screen.getByRole('button', { name: 'หยุดชั่วคราว' });
    fireEvent.click(pauseBtn);
    expect(screen.getByText('เริ่ม')).toBeDefined();

    // Advance timer while paused - time shouldn't change
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('24:57')).toBeDefined();

    // Reset
    const resetBtn = screen.getByRole('button', { name: 'รีเซ็ตเวลา' });
    fireEvent.click(resetBtn);
    expect(screen.getByText('25:00')).toBeDefined();
  });

  it('toggles sound on and off', () => {
    render(<FocusTimerWidget width={1} />);
    const soundBtn = screen.getByRole('button', { name: 'ปิดเสียงเตือน' });
    fireEvent.click(soundBtn);
    expect(screen.getByRole('button', { name: 'เปิดเสียงเตือน' })).toBeDefined();
    expect(screen.getByText(/เสียงปิด/)).toBeDefined();
  });

  it('renders correctly in size M (width=2) and size L (width=3)', () => {
    const onResize = vi.fn();
    const { rerender } = render(<FocusTimerWidget width={2} onResize={onResize} />);
    expect(screen.getByText('เป้าหมายรอบวันนี้')).toBeDefined();
    expect(screen.getByText('เริ่มโฟกัส')).toBeDefined();

    rerender(<FocusTimerWidget width={3} onResize={onResize} />);
    expect(screen.getByText('สรุปผลผลิตวันนี้')).toBeDefined();
    expect(screen.getByText('เลือกโหมดการทำงาน')).toBeDefined();
  });
});
