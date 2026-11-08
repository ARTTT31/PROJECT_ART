import { describe, it, expect, vi } from 'vitest';
import { drawDailyCardCanvas, CardDigestData } from './cardGenerator';

describe('cardGenerator', () => {
  const sampleData: CardDigestData = {
    companyName: 'ART WORKSPACE',
    dateStr: 'วันจันทร์ที่ 9 พฤศจิกายน 2569',
    weather: { temp: 31, condition: 'แจ่มใส', pm25: 18 },
    oil: { diesel: 32.94, gasohol95: 38.55, status: 'ปกติ' },
    market: { setIndex: 1450.5, setChange: 5.2, usdRate: 34.25 },
    pendingTasks: 3,
  };

  it('draws on canvas and sets dimensions to 1080x1080', () => {
    const canvas = document.createElement('canvas');
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
    };
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

    drawDailyCardCanvas(canvas, sampleData);

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1080);
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith(expect.stringContaining('ART WORKSPACE'), expect.any(Number), expect.any(Number));
  });
});
