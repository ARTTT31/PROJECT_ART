import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownText from './MarkdownText';

describe('MarkdownText', () => {
  it('renders headings, bullets and bold as elements', () => {
    render(<MarkdownText text={'## สรุป\n\n- **น้ำมัน** 32.94\n- อากาศ 32°C'} />);

    expect(screen.getByText('สรุป')).toBeInTheDocument();
    expect(screen.getByText('น้ำมัน').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a pipe table', () => {
    render(<MarkdownText text={'| รายการ | ราคา |\n|---|---|\n| ดีเซล | 32.94 |'} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ราคา' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '32.94' })).toBeInTheDocument();
  });

  it('renders a quote as a quote instead of a stray >', () => {
    render(<MarkdownText text={'> ใช้ baht เป็นหน่วยเงิน'} />);

    const quote = screen.getByText(/ใช้ baht เป็นหน่วยเงิน/);
    expect(quote.closest('blockquote')).not.toBeNull();
  });

  it('keeps a fenced block literal', () => {
    render(<MarkdownText text={'```\nconst a = 1 < 2;\n```'} />);

    expect(screen.getByText('const a = 1 < 2;')).toBeInTheDocument();
  });

  it('never interprets HTML in a reply', () => {
    const { container } = render(
      <MarkdownText text={'<b>hi</b> <script>alert(1)</script>'} />,
    );

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<b>hi</b>');
  });

  it('keeps the line breaks of a plain answer', () => {
    render(<MarkdownText text={'บรรทัดแรก\nบรรทัดที่สอง'} />);

    expect(screen.getByText(/บรรทัดแรก/)).toHaveClass('whitespace-pre-line');
  });
});
