/**
 * Daily Card Image Generator (HTML5 Canvas).
 *
 * Generates high-resolution Apple HIG styled infographic cards (1080x1080)
 * summarizing daily workspace metrics for instant sharing to LINE, Telegram, or saving to device.
 */

export interface CardDigestData {
  companyName?: string;
  dateStr: string;
  weather: {
    temp: number | null;
    condition: string;
    pm25: number | null;
  };
  oil: {
    diesel: number | null;
    gasohol95: number | null;
    status: string;
  };
  market: {
    setIndex: number | null;
    setChange: number | null;
    usdRate: number | null;
  };
  pendingTasks: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function drawDailyCardCanvas(
  canvas: HTMLCanvasElement,
  data: CardDigestData,
): void {
  const width = 1080;
  const height = 1080;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background: Deep Executive Slate gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient glow orbs
  const glowGrad = ctx.createRadialGradient(200, 150, 20, 200, 150, 450);
  glowGrad.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
  glowGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Hairline Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 36);
  ctx.stroke();

  // Font Stack
  const fontMain = 'system-ui, -apple-system, "SF Pro Display", Sarabun, sans-serif';

  // ── Header: Brand & Date ──────────────────────────────────────────
  // Logo Mark badge
  ctx.fillStyle = '#0284c7';
  drawRoundedRect(ctx, 72, 72, 54, 54, 16);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 28px ${fontMain}`;
  ctx.fillText('A', 88, 110);

  // Brand Name
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${fontMain}`;
  ctx.fillText(data.companyName || 'ART WORKSPACE', 142, 98);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `500 18px ${fontMain}`;
  ctx.fillText('สรุปภาพรวมประจำวันอัจฉริยะ', 142, 126);

  // Date Badge (Right-aligned)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, width - 420, 72, 348, 54, 27);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, width - 420, 72, 348, 54, 27);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = `600 20px ${fontMain}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.dateStr, width - 246, 107);
  ctx.textAlign = 'left';

  // ── 4 Main Metric Cards (2x2 Grid) ────────────────────────────────
  const cardW = 444;
  const cardH = 260;
  const col1 = 72;
  const col2 = 564;
  const row1 = 170;
  const row2 = 470;

  const cards = [
    {
      x: col1,
      y: row1,
      title: 'สภาพอากาศและสิ่งแวดล้อม',
      icon: '🌤️',
      primary: `${data.weather.temp ?? 31}°C`,
      secondary: data.weather.condition || 'ท้องฟ้าแจ่มใส',
      badge: `PM2.5: ${data.weather.pm25 ?? 'ปกติ'}`,
      badgeColor: '#10b981',
    },
    {
      x: col2,
      y: row1,
      title: 'ราคาน้ำมันขายปลีกวันนี้',
      icon: '⛽',
      primary: `ดีเซล ${data.oil.diesel ?? '-'} ฿`,
      secondary: `แก๊สโซฮอล์ 95: ${data.oil.gasohol95 ?? '-'} ฿`,
      badge: `สถานะ: ${data.oil.status}`,
      badgeColor: '#0ea5e9',
    },
    {
      x: col1,
      y: row2,
      title: 'ตลาดการเงินและดัชนี SET',
      icon: '📈',
      primary: `SET ${data.market.setIndex ?? '-'}`,
      secondary: `อัตราแลกเปลี่ยน USD/THB: ${data.market.usdRate ?? '-'}`,
      badge: (data.market.setChange ?? 0) >= 0 ? `+${data.market.setChange ?? 0}` : `${data.market.setChange}`,
      badgeColor: (data.market.setChange ?? 0) >= 0 ? '#10b981' : '#ef4444',
    },
    {
      x: col2,
      y: row2,
      title: 'ภารกิจและสิ่งที่ต้องทำ',
      icon: '📋',
      primary: `${data.pendingTasks} รายการ`,
      secondary: 'งานที่ค้างอยู่ใน To-Do List',
      badge: data.pendingTasks === 0 ? 'เคลียร์งานหมดแล้ว' : 'รอการจัดการ',
      badgeColor: data.pendingTasks === 0 ? '#10b981' : '#f59e0b',
    },
  ];

  for (const c of cards) {
    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    drawRoundedRect(ctx, c.x, c.y, cardW, cardH, 24);
    ctx.fill();

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, c.x, c.y, cardW, cardH, 24);
    ctx.stroke();

    // Title & Icon
    ctx.font = `28px ${fontMain}`;
    ctx.fillText(c.icon, c.x + 28, c.y + 54);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `600 20px ${fontMain}`;
    ctx.fillText(c.title, c.x + 72, c.y + 52);

    // Primary Big Value
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${fontMain}`;
    ctx.fillText(c.primary, c.x + 28, c.y + 128);

    // Secondary Description
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `500 20px ${fontMain}`;
    ctx.fillText(c.secondary, c.x + 28, c.y + 172);

    // Badge Pill
    ctx.fillStyle = `${c.badgeColor}22`;
    drawRoundedRect(ctx, c.x + 28, c.y + 196, 210, 36, 18);
    ctx.fill();
    ctx.strokeStyle = `${c.badgeColor}66`;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, c.x + 28, c.y + 196, 210, 36, 18);
    ctx.stroke();

    ctx.fillStyle = c.badgeColor;
    ctx.font = `bold 16px ${fontMain}`;
    ctx.fillText(c.badge, c.x + 46, c.y + 221);
  }

  // ── Narrative Briefing Box (Bottom Full Width) ────────────────────
  const boxY = 770;
  const boxH = 170;
  ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
  drawRoundedRect(ctx, col1, boxY, width - 144, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, col1, boxY, width - 144, boxH, 24);
  ctx.stroke();

  // Pulse dot & Heading
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(col1 + 36, boxY + 42, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 22px ${fontMain}`;
  ctx.fillText('ภาพรวมความพร้อมประจำวันสำหรับคุณ', col1 + 56, boxY + 49);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `400 20px ${fontMain}`;
  ctx.fillText(
    `อุณหภูมิวันนี้ ${data.weather.temp ?? 31}°C · ราคาน้ำมัน: ${data.oil.status} · ตลาด SET: ${data.market.setIndex ?? '-'} · งานค้าง: ${data.pendingTasks} รายการ`,
    col1 + 36,
    boxY + 95,
  );
  ctx.fillText('ระบบพร้อมสนับสนุนการทำงานของคุณตลอด 24 ชั่วโมง มีวันที่ยอดเยี่ยมครับ!', col1 + 36, boxY + 130);

  // ── Footer ────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = `400 17px ${fontMain}`;
  ctx.textAlign = 'center';
  ctx.fillText('สร้างโดย ART Workspace · ระบบจัดการวันทำงานของคุณให้ง่ายขึ้น', width / 2, 995);
  ctx.textAlign = 'left';
}

export async function createDailyCardBlob(data: CardDigestData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawDailyCardCanvas(canvas, data);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

export async function shareOrDownloadDailyCard(
  data: CardDigestData,
  filename: string = 'art-workspace-daily.png',
): Promise<'shared' | 'downloaded'> {
  const blob = await createDailyCardBlob(data);

  // 1. Try mobile Web Share API with files support
  const file = new File([blob], filename, { type: 'image/png' });
  if (
    typeof navigator !== 'undefined' &&
    'canShare' in navigator &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: 'ART Workspace สรุปประจำวัน',
        text: `สรุปภาพรวมประจำวัน (${data.dateStr})`,
        files: [file],
      });
      return 'shared';
    } catch (shareErr) {
      // User cancelled share dialog or unsupported, fall through to download
      if (shareErr instanceof Error && shareErr.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  // 2. Direct browser download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}
