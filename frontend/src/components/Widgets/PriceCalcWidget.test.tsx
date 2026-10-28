import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceCalcWidget from './PriceCalcWidget';

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('PriceCalcWidget', () => {
  it('computes the discounted price, profit and margin', () => {
    render(<PriceCalcWidget />);

    fill('ต้นทุน (บาท)', '100');
    fill('ราคาตั้งขาย', '200');
    fill('ส่วนลด (%)', '10');

    expect(screen.getByText('180.00')).toBeTruthy();
    expect(screen.getByText('80.00')).toBeTruthy();
    expect(screen.getByText('44.4%')).toBeTruthy();
  });

  it('shows a loss when the cost is above the discounted price', () => {
    render(<PriceCalcWidget />);

    fill('ต้นทุน (บาท)', '150');
    fill('ราคาตั้งขาย', '120');

    expect(screen.getAllByText('-30.00').length).toBeGreaterThan(0);
    expect(screen.getByText('-25.0%')).toBeTruthy();
  });

  it('clamps a discount above 100% instead of showing a negative price', () => {
    render(<PriceCalcWidget />);

    fill('ราคาตั้งขาย', '500');
    fill('ส่วนลด (%)', '150');

    // Net and profit are both zero, and nothing is negative.
    expect(screen.getAllByText('0.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/^-/)).toBeNull();
  });

  it('shows placeholders until something is typed', () => {
    render(<PriceCalcWidget />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('กรอกตัวเลขเพื่อเริ่มคำนวณ')).toBeTruthy();
  });
});
