import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WidgetManagerDialog from './WidgetManagerDialog';
import type { WidgetConfig } from '@/types';

vi.mock('@/utils/sweetalert', () => ({
  showConfirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
}));

const WIDGETS: WidgetConfig[] = [
  { id: 'digest', w: 2 },
  { id: 'notes', w: 1 },
  { id: 'calc', w: 1 },
  { id: 'focustimer', w: 1 },
  { id: 'calendar', w: 2 },
  { id: 'market', w: 2 },
  { id: 'finance', w: 1 },
  { id: 'watchlist', w: 1 },
  { id: 'converter', w: 1 },
  { id: 'holidays', w: 1 },
  { id: 'weather', w: 1 },
  { id: 'oilprice', w: 1 },
  { id: 'qrcode', w: 1 },
];

const LABELS: Record<string, string> = {
  digest: 'สรุปประจำวัน',
  notes: 'โน้ตด่วน',
  calc: 'คิดราคา',
  focustimer: 'โฟกัสและจับเวลา',
  calendar: 'ปฏิทินและตารางนัด',
  market: 'ค่าเงิน ทอง SET',
  finance: 'รายรับรายจ่าย',
  watchlist: 'รายการติดตาม',
  converter: 'แปลงสกุลเงิน',
  holidays: 'วันหยุดนักขัตฤกษ์',
  weather: 'สภาพอากาศ',
  oilprice: 'ราคาน้ำมัน',
  qrcode: 'สร้าง QR Code',
};

const DESCRIPTIONS: Record<string, string> = {
  digest: 'สรุปสภาพอากาศ ราคาน้ำมัน และภารกิจประจำวัน',
  notes: 'จดรายการที่ต้องทำวันนี้',
  calc: 'คิดราคาขายและกำไรต่อชิ้น',
  focustimer: 'จับเวลาทำงานสไตล์ Pomodoro',
  calendar: 'ปฏิทินนัดหมายและวันหยุด',
  market: 'อัตราแลกเปลี่ยนและดัชนีตลาด',
  finance: 'บันทึกรายรับรายจ่ายของวันนี้',
  watchlist: 'ติดตามหุ้นและค่าเงินที่สนใจ',
  converter: 'แปลงเงินบาทเป็นสกุลอื่น',
  holidays: 'นับถอยหลังวันหยุดไทย',
  weather: 'อุณหภูมิและฝุ่น PM 2.5',
  oilprice: 'ติดตามราคาน้ำมันล่าสุด',
  qrcode: 'สร้าง QR Code อย่างรวดเร็ว',
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof WidgetManagerDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    widgets: WIDGETS,
    visibleWidgetIds: WIDGETS.map((widget) => widget.id),
    onToggle: vi.fn(),
    onApplyPreset: vi.fn(),
    onReset: vi.fn(),
    label: (id: string) => LABELS[id] ?? id,
    description: (id: string) => DESCRIPTIONS[id] ?? '',
    ...overrides,
  };

  render(<WidgetManagerDialog {...props} />);
  return props;
}

describe('WidgetManagerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every widget exactly once under its group', () => {
    renderDialog();

    for (const label of Object.values(LABELS)) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }
    expect(screen.getByText('ข้อมูลประจำวัน')).toBeInTheDocument();
    expect(screen.getByText('งานและเวลา')).toBeInTheDocument();
    expect(screen.getByText('การเงิน & ตลาด')).toBeInTheDocument();
    expect(screen.getByText(/เปิดใช้งาน 13 จาก 13 วิดเจ็ต/)).toBeInTheDocument();
  });

  it('filters the list with the search box and can clear it', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('ค้นหาวิดเจ็ต'), { target: { value: 'โฟกัส' } });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /^โฟกัสและจับเวลา/ })).toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: /^โน้ตด่วน/ })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/พบ 1 รายการ/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ล้างคำค้นหา' }));

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /^โน้ตด่วน/ })).toBeInTheDocument();
    });
  });

  it('shows an empty state when nothing matches', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('ค้นหาวิดเจ็ต'), { target: { value: 'ไม่มีจริง' } });

    await waitFor(() => {
      expect(screen.getByText(/ไม่พบวิดเจ็ตที่ตรงกับ/)).toBeInTheDocument();
    });
  });

  it('toggles a widget from its whole card', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('switch', { name: /^สภาพอากาศ/ }));

    expect(props.onToggle).toHaveBeenCalledWith('weather');
  });

  it('disables the switch when it is the only visible widget', () => {
    renderDialog({ visibleWidgetIds: ['weather'] });

    expect(screen.getByRole('switch', { name: /^สภาพอากาศ/ })).toBeDisabled();
  });

  it('reveals the role presets and applies one', async () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /แม่แบบจัดหน้าตามสายงาน/ }));
    const preset = await screen.findByRole('button', { name: /ผู้บริหาร & การเงิน/ });

    fireEvent.click(preset);

    expect(props.onApplyPreset).toHaveBeenCalledWith('executive');
  });

  it('resets the layout after the confirmation dialog', async () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /รีเซ็ตค่าเริ่มต้น/ }));

    await waitFor(() => expect(props.onReset).toHaveBeenCalledTimes(1));
  });
});
