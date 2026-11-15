import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React, { createRef } from 'react';
import { Button } from './Button';
import { Search } from 'lucide-react';

describe('Button', () => {
  it('renders with default props (secondary variant, md size, button type)', () => {
    render(<Button>คลิกที่นี่</Button>);
    const button = screen.getByRole('button', { name: 'คลิกที่นี่' });
    expect(button).toBeDefined();
    expect(button.getAttribute('type')).toBe('button');
  });

  it('renders primary variant with proper token classes', () => {
    render(<Button variant="primary">บันทึกข้อมูล</Button>);
    const button = screen.getByRole('button', { name: 'บันทึกข้อมูล' });
    expect(button.className).toContain('bg-[var(--accent)]');
  });

  it('renders destructive variant with danger styling', () => {
    render(<Button variant="destructive">ลบรายการ</Button>);
    const button = screen.getByRole('button', { name: 'ลบรายการ' });
    expect(button.className).toContain('text-[var(--danger)]');
  });

  it('handles click events when not disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>กดฉัน</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'กดฉัน' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger click when disabled or loading', () => {
    const handleClick = vi.fn();
    const { rerender } = render(<Button disabled onClick={handleClick}>ปิดใช้งาน</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'ปิดใช้งาน' }));
    expect(handleClick).not.toHaveBeenCalled();

    rerender(<Button loading onClick={handleClick}>กำลังโหลด</Button>);
    const loadingBtn = screen.getByRole('button', { name: 'กำลังโหลด' });
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(loadingBtn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders iconOnly button with accessible label', () => {
    render(
      <Button iconOnly aria-label="ค้นหา">
        <Search size={16} />
      </Button>
    );
    const button = screen.getByRole('button', { name: 'ค้นหา' });
    expect(button).toBeDefined();
  });

  it('attaches ref directly in React 19', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>อ้างอิง</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
