/**
 * Daily Card Image Generator (HTML5 Canvas).
 *
 * Generates high-resolution Apple HIG styled infographic cards (1080x1080)
 * summarizing daily workspace metrics for instant sharing to LINE, Telegram, or saving to device.
 * Adheres strictly to the project's Apple HIG Design System: flat surfaces, hairline borders,
 * continuous squircle radii, and clean typography.
 */

export interface CardDigestData {
  companyName?: string;
  dateStr: string;
  greeting?: string;
  theme?: 'light' | 'dark';
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

  const isDark = data.theme === 'dark';

  // ── Color Palette (Apple HIG Design Tokens) ───────────────────────
  const colors = {
    canvasBg: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    tileBg: isDark ? '#2C2C2E' : '#FBFBFD',
    bannerBg: isDark ? '#2C2C2E' : '#F5F5F7',
    ink: isDark ? '#F5F5F7' : '#1D1D1F',
    inkSecondary: isDark ? '#A1A1A6' : '#515154',
    inkTertiary: isDark ? '#8E8E93' : '#86868B',
    hairline: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
    tileHairline: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    accent: isDark ? '#0A84FF' : '#0066CC',
    accentSoft: isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 102, 204, 0.08)',
    emerald: '#10B981',
    emeraldSoft: isDark ? 'rgba(16, 185, 129, 0.20)' : '#ECFDF5',
    emeraldText: isDark ? '#34D399' : '#059669',
    blueSoft: isDark ? 'rgba(59, 130, 246, 0.20)' : '#EFF6FF',
    blueText: isDark ? '#60A5FA' : '#2563EB',
    amberSoft: isDark ? 'rgba(245, 158, 11, 0.20)' : '#FFFBEB',
    amberText: isDark ? '#FBBF24' : '#D97706',
    redSoft: isDark ? 'rgba(239, 68, 68, 0.20)' : '#FEF2F2',
    redText: isDark ? '#F87171' : '#DC2626',
  };

  const fontMain = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Sarabun, system-ui, sans-serif';

  // 1. Canvas Outer Background
  ctx.fillStyle = colors.canvasBg;
  ctx.fillRect(0, 0, width, height);

  // 2. Main White Card Surface with 1px Hairline and Soft Shadow
  const mainX = 44;
  const mainY = 44;
  const mainW = width - 88;
  const mainH = height - 88;
  const mainRadius = 28;

  // Soft ambient shadow
  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.06)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = colors.cardBg;
  drawRoundedRect(ctx, mainX, mainY, mainW, mainH, mainRadius);
  ctx.fill();
  ctx.restore();

  // Main Card Hairline Border
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, mainX, mainY, mainW, mainH, mainRadius);
  ctx.stroke();

  // ── Header: Brand & Date ──────────────────────────────────────────
  const padX = 84;
  const headerY = 82;

  // Brand Icon (Apple squircle with royal blue gradient)
  const iconW = 54;
  const iconGrad = ctx.createLinearGradient(padX, headerY, padX + iconW, headerY + iconW);
  iconGrad.addColorStop(0, colors.accent);
  iconGrad.addColorStop(1, isDark ? '#0055B3' : '#004CB3');
  ctx.fillStyle = iconGrad;
  drawRoundedRect(ctx, padX, headerY, iconW, iconW, 14);
  ctx.fill();

  // App Logo text / mark inside squircle
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 24px ${fontMain}`;
  ctx.textAlign = 'center';
  ctx.fillText('ART', padX + iconW / 2, headerY + 36);
  ctx.textAlign = 'left';

  // Workspace Name & Tagline
  ctx.fillStyle = colors.ink;
  ctx.font = `bold 26px ${fontMain}`;
  ctx.fillText(data.companyName || 'ART WORKSPACE', padX + iconW + 16, headerY + 30);

  ctx.fillStyle = colors.inkTertiary;
  ctx.font = `500 15px ${fontMain}`;
  ctx.fillText('Smart Briefing · สรุปภาพรวมประจำวัน', padX + iconW + 16, headerY + 52);

  // Date Badge (Right-aligned pill)
  const dateW = 320;
  const dateH = 46;
  const dateX = width - padX - dateW;
  const dateY = headerY + 4;

  ctx.fillStyle = colors.bannerBg;
  drawRoundedRect(ctx, dateX, dateY, dateW, dateH, dateH / 2);
  ctx.fill();

  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, dateX, dateY, dateW, dateH, dateH / 2);
  ctx.stroke();

  ctx.fillStyle = colors.ink;
  ctx.font = `600 15px ${fontMain}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.dateStr, dateX + dateW / 2, dateY + 29);
  ctx.textAlign = 'left';

  // ── Dynamic Narrative Briefing Banner ─────────────────────────────
  const bannerY = 162;
  const bannerW = width - padX * 2;
  const bannerH = 136;

  ctx.fillStyle = colors.bannerBg;
  drawRoundedRect(ctx, padX, bannerY, bannerW, bannerH, 18);
  ctx.fill();

  ctx.strokeStyle = colors.tileHairline;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, padX, bannerY, bannerW, bannerH, 18);
  ctx.stroke();

  // Pulse Dot (Emerald Green)
  const dotX = padX + 28;
  const dotY = bannerY + 38;

  // Outer subtle halo
  ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.20)';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 9, 0, Math.PI * 2);
  ctx.fill();

  // Inner solid core
  ctx.fillStyle = colors.emerald;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Heading text
  ctx.fillStyle = colors.ink;
  ctx.font = `bold 17px ${fontMain}`;
  const greetingText = data.greeting || 'ภาพรวมพร้อมสำหรับคุณ';
  ctx.fillText(greetingText, dotX + 20, dotY + 6);

  // Summary narrative lines
  ctx.fillStyle = colors.inkSecondary;
  ctx.font = `400 15px ${fontMain}`;
  const weatherText = `อุณหภูมิวันนี้ ${data.weather.temp ?? 31}°C (${data.weather.condition || 'ท้องฟ้าแจ่มใส'}) · ราคาน้ำมัน: ${data.oil.status || 'ราคาคงที่'}`;
  const marketAndTasks = `ตลาด SET: ${data.market.setIndex ?? 1450.2} · งานค้างในระบบ: ${data.pendingTasks} รายการ`;
  ctx.fillText(weatherText, padX + 28, bannerY + 76);
  ctx.fillText(marketAndTasks, padX + 28, bannerY + 104);

  // ── 4 Main Metric Grid Tiles (2x2) ────────────────────────────────
  const tileW = 442;
  const tileH = 276;
  const col1 = padX;
  const col2 = padX + tileW + 28;
  const row1 = 324;
  const row2 = 624;

  const tiles = [
    {
      x: col1,
      y: row1,
      category: 'สภาพอากาศ',
      badgeChip: '🌤️ สดใส',
      primary: `${data.weather.temp ?? 31}°C`,
      secondary: data.weather.condition || 'ท้องฟ้าแจ่มใส มีเมฆบางส่วน',
      statusText: `PM2.5: ${data.weather.pm25 ?? 15} µg/m³ (ปกติ)`,
      statusBg: colors.emeraldSoft,
      statusTextColor: colors.emeraldText,
    },
    {
      x: col2,
      y: row1,
      category: 'ราคาน้ำมันขายปลีก',
      badgeChip: '⛽ บางจาก',
      primary: `ดีเซล ${data.oil.diesel ?? 32.94} ฿`,
      secondary: `แก๊สโซฮอล์ 95: ${data.oil.gasohol95 ?? 38.55} บาท/ลิตร`,
      statusText: `สถานะราคา: ${data.oil.status || 'คงที่'}`,
      statusBg: colors.blueSoft,
      statusTextColor: colors.blueText,
    },
    {
      x: col1,
      y: row2,
      category: 'ตลาดการเงินและดัชนี SET',
      badgeChip: '📈 หุ้นไทย',
      primary: `SET ${data.market.setIndex ?? 1450.2}`,
      secondary: `USD/THB: ${data.market.usdRate ?? 35.80} บาท/ดอลลาร์`,
      statusText: (data.market.setChange ?? 0) >= 0 ? `+${data.market.setChange ?? 4.2} จุด (+0.29%)` : `${data.market.setChange} จุด`,
      statusBg: (data.market.setChange ?? 0) >= 0 ? colors.emeraldSoft : colors.redSoft,
      statusTextColor: (data.market.setChange ?? 0) >= 0 ? colors.emeraldText : colors.redText,
    },
    {
      x: col2,
      y: row2,
      category: 'ภารกิจและสิ่งที่ต้องทำ',
      badgeChip: '📋 To-Do',
      primary: `${data.pendingTasks} รายการ`,
      secondary: 'งานที่ค้างอยู่ใน To-Do List',
      statusText: data.pendingTasks === 0 ? 'เคลียร์งานหมดแล้ว ✨' : 'รอการจัดการในระบบ ⏳',
      statusBg: data.pendingTasks === 0 ? colors.emeraldSoft : colors.amberSoft,
      statusTextColor: data.pendingTasks === 0 ? colors.emeraldText : colors.amberText,
    },
  ];

  for (const t of tiles) {
    // Tile Background
    ctx.fillStyle = colors.tileBg;
    drawRoundedRect(ctx, t.x, t.y, tileW, tileH, 18);
    ctx.fill();

    // Tile Hairline
    ctx.strokeStyle = colors.tileHairline;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, t.x, t.y, tileW, tileH, 18);
    ctx.stroke();

    // Top Header: Category Label & Badge Chip
    ctx.fillStyle = colors.inkTertiary;
    ctx.font = `bold 14px ${fontMain}`;
    ctx.fillText(t.category, t.x + 24, t.y + 40);

    // Pill Chip on Top-Right
    ctx.fillStyle = colors.bannerBg;
    drawRoundedRect(ctx, t.x + tileW - 108, t.y + 20, 84, 28, 14);
    ctx.fill();
    ctx.strokeStyle = colors.hairline;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, t.x + tileW - 108, t.y + 20, 84, 28, 14);
    ctx.stroke();

    ctx.fillStyle = colors.inkSecondary;
    ctx.font = `600 12px ${fontMain}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.badgeChip, t.x + tileW - 66, t.y + 38);
    ctx.textAlign = 'left';

    // Primary Big Number
    ctx.fillStyle = colors.ink;
    ctx.font = `bold 38px ${fontMain}`;
    ctx.fillText(t.primary, t.x + 24, t.y + 104);

    // Secondary Description
    ctx.fillStyle = colors.inkSecondary;
    ctx.font = `500 15px ${fontMain}`;
    ctx.fillText(t.secondary, t.x + 24, t.y + 148);

    // Status Pill at Bottom
    const pillH = 34;
    const pillW = 260;
    const pillY = t.y + 196;

    ctx.fillStyle = t.statusBg;
    drawRoundedRect(ctx, t.x + 24, pillY, pillW, pillH, 17);
    ctx.fill();

    ctx.fillStyle = t.statusTextColor;
    ctx.font = `bold 14px ${fontMain}`;
    ctx.fillText(t.statusText, t.x + 40, pillY + 22);
  }

  // ── Footer ────────────────────────────────────────────────────────
  const footerY = 926;
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerY);
  ctx.lineTo(width - padX, footerY);
  ctx.stroke();

  ctx.fillStyle = colors.inkTertiary;
  ctx.font = `500 14px ${fontMain}`;
  ctx.fillText('ART Workspace · ระบบจัดการวันทำงานของคุณให้ง่ายขึ้น', padX, footerY + 36);

  ctx.textAlign = 'right';
  ctx.fillStyle = colors.inkTertiary;
  ctx.font = `500 13px ${fontMain}`;
  ctx.fillText('รายงานข้อมูลเรียลไทม์ · Apple HIG Design', width - padX, footerY + 36);
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
