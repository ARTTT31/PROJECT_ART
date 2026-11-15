import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WidgetState } from './WidgetState';
import { AlertCircle } from 'lucide-react';

describe('WidgetState', () => {
  it('renders empty state correctly with title and description', () => {
    render(
      <WidgetState
        kind="empty"
        title="ไม่มีข้อมูล"
        description="ไม่พบรายการในขณะนี้"
      />
    );

    expect(screen.getByText('ไม่มีข้อมูล')).toBeDefined();
    expect(screen.getByText('ไม่พบรายการในขณะนี้')).toBeDefined();
    expect(screen.queryByRole('button', { name: /ลองใหม่/i })).toBeNull();
  });

  it('renders error state and triggers onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(
      <WidgetState
        kind="error"
        title="โหลดข้อมูลไม่สำเร็จ"
        description="กรุณาตรวจสอบการเชื่อมต่อ"
        onRetry={onRetry}
        icon={AlertCircle}
      />
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('โหลดข้อมูลไม่สำเร็จ')).toBeDefined();
    expect(screen.getByText('กรุณาตรวจสอบการเชื่อมต่อ')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /ลองใหม่/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders loading state with aria-busy', () => {
    render(
      <WidgetState
        kind="loading"
        title="กำลังโหลดข้อมูล..."
      />
    );

    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('กำลังโหลดข้อมูล...')).toBeDefined();
  });
});
