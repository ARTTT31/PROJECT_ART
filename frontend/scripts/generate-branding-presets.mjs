#!/usr/bin/env node
/**
 * Generates `src/lib/brandingPresets.ts`.
 *
 * The branding card offers ready-made name + logo combinations. A preset logo
 * has to survive the same backend validation as an upload, which only accepts
 * an http(s) URL or a base64 PNG/JPEG/GIF/WebP data URL — SVG is refused because
 * it can carry script. So the marks are drawn here and encoded as PNG data URLs,
 * which the sidebar, the profile preview and the favicon all already know how to
 * render.
 *
 * The canvas is 512px, the largest size the PWA icon route asks for. A 128px
 * mark used to be stored as-is, so a 512px launcher slot upscaled it and the
 * installed icon looked soft. Marks stay flat colour on purpose: a per-pixel
 * gradient would multiply the committed data URLs for no visible gain at the
 * 26–36px sizes the UI actually renders them at.
 *
 * Run with: node scripts/generate-branding-presets.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SIZE = 512;
const SAMPLES = 3; // 3x3 supersampling for smooth edges

// ── minimal PNG encoder (RGBA, no filter) ────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodeIndexedPng(width, height, indices, palette) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 3; // colour type: indexed
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach(([r, g, b], index) => {
    plte[index * 3] = r;
    plte[index * 3 + 1] = g;
    plte[index * 3 + 2] = b;
  });

  // PNG filter "Up" (2): every byte stores the difference from the index above.
  // The marks are a flat background with one colour on top, so most rows are
  // identical and become zeros — much smaller than unfiltered truecolour.
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width + 1);
    raw[rowStart] = 2; // filter type: Up
    for (let x = 0; x < width; x += 1) {
      const above = y > 0 ? indices[(y - 1) * width + x] : 0;
      raw[rowStart + 1 + x] = (indices[y * width + x] - above) & 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── glyphs: (x, y) normalised to -1..1, returns white coverage 0..1 ──────────
// Every mark stays inside |x|,|y| < 0.8 so it keeps a margin in the rounded
// square the UI draws it in, and edges are rounded rather than sharp.

/** Distance to a rounded rectangle outline (negative inside). */
function roundedRect(x, y, halfWidth, halfHeight, radius, mask = 1) {
  const dx = Math.abs(x) - (halfWidth - radius);
  const dy = Math.abs(y) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return (outside + inside - radius) * mask;
}

function cover(distance, feather = 0.02) {
  return distance < -feather ? 1 : distance > feather ? 0 : (feather - distance) / (2 * feather);
}

/** Fill test for the polygon-based marks (sampling provides the antialiasing). */
function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a line segment — used for the pulse mark. */
function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy || 1e-6;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

const glyphs = {
  orbit(x, y) {
    const r = Math.hypot(x, y);
    // A hollow ring with a satellite dot sitting just outside it.
    const ring = cover(Math.abs(r - 0.45) - 0.115);
    const dot = cover(Math.hypot(x - 0.6, y + 0.6) - 0.145);
    return Math.max(ring, dot);
  },
  tiles(x, y) {
    const size = 0.28;
    let value = 0;
    for (const cx of [-0.34, 0.34]) {
      for (const cy of [-0.34, 0.34]) {
        const outer = cover(roundedRect(x - cx, y - cy, size, size, 0.12));
        // The top-right cell is an outline: a half-opacity fill blended into a
        // muddy tint on the coloured background and read as a colour mistake.
        if (cx > 0 && cy < 0) {
          const inner = cover(roundedRect(x - cx, y - cy, size - 0.1, size - 0.1, 0.07));
          value = Math.max(value, Math.max(0, outer - inner));
        } else {
          value = Math.max(value, outer);
        }
      }
    }
    return value;
  },
  spark(x, y) {
    const star = Math.pow(Math.abs(x), 0.6) + Math.pow(Math.abs(y), 0.6);
    return cover(star - 0.8);
  },
  wave(x, y) {
    const line = 0.3 * Math.sin(x * 2.8);
    return cover(Math.abs(y - line) - 0.13) * (Math.abs(x) < 0.86 ? 1 : 0);
  },
  bloom(x, y) {
    // Six petals around a solid core — a clean flower instead of a ring whose
    // lobes overlapped and left a dark blob in the middle.
    let value = cover(Math.hypot(x, y) - 0.14);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index * Math.PI) / 3;
      const px = Math.cos(angle) * 0.42;
      const py = Math.sin(angle) * 0.42;
      value = Math.max(value, cover(Math.hypot(x - px, y - py) - 0.21));
    }
    return value;
  },
  peaks(x, y) {
    // Two nested chevrons, a mountain mark clipped to a round safe area.
    let value = 0;
    for (const offset of [0, 0.22]) {
      const lineY = -0.34 + Math.abs(x) * 0.62 + offset;
      const onLine = cover(Math.abs(y - lineY) - 0.085);
      const inside = Math.abs(x) < 0.72 - offset * 0.6 && lineY < 0.66 ? 1 : 0;
      value = Math.max(value, onLine * inside);
    }
    return value;
  },
  heart(x, y) {
    // Classic implicit heart, flipped for screen coordinates and scaled down.
    const sx = x / 0.62;
    const sy = (-y + 0.06) / 0.62;
    const base = sx * sx + sy * sy - 1;
    return cover((base * base * base - sx * sx * sy * sy * sy) * 18);
  },
  compass(x, y) {
    // A ring with four cardinals and a slim north–south needle.
    const r = Math.hypot(x, y);
    const ring = cover(Math.abs(r - 0.56) - 0.06);
    let ticks = 0;
    for (let index = 0; index < 4; index += 1) {
      const angle = (index * Math.PI) / 2;
      const tickX = Math.cos(angle) * 0.73;
      const tickY = Math.sin(angle) * 0.73;
      ticks = Math.max(ticks, cover(Math.hypot(x - tickX, y - tickY) - 0.052));
    }
    const u = (x + y) * 0.7071;
    const v = (x - y) * 0.7071;
    const needle = cover(Math.abs(v) * 3.1 + Math.abs(u) - 0.46);
    return Math.max(ring, ticks, needle * 0.95);
  },
  layers(x, y) {
    // Sheared slabs (the Figma "layers" mark). Three plain horizontal bars read
    // as a hamburger menu, which is the last thing an app icon should say.
    const skewedX = x + y * 0.5;
    let value = 0;
    const widths = [0.64, 0.55, 0.46];
    for (let index = 0; index < 3; index += 1) {
      const centreY = -0.34 + index * 0.34;
      value = Math.max(value, cover(roundedRect(skewedX, y - centreY, widths[index], 0.095, 0.095)));
    }
    return value;
  },
  bolt(x, y) {
    // A filled lightning bolt; the polygon helper supplies the smooth edge.
    const points = [
      [0.2, -0.8],
      [-0.36, 0.06],
      [-0.04, 0.06],
      [-0.18, 0.8],
      [0.38, -0.08],
      [0.06, -0.08],
    ];
    return pointInPolygon(x, y, points) ? 1 : 0;
  },
  aperture(x, y) {
    // A lens diaphragm: a thin ring, a solid core and six short blades between
    // them. A thick cos-modulated ring rendered as a vinyl record at icon size.
    const r = Math.hypot(x, y);
    let value = Math.max(cover(Math.abs(r - 0.58) - 0.055), cover(r - 0.17));
    for (let index = 0; index < 6; index += 1) {
      const angle = (index * Math.PI) / 3 + Math.PI / 6;
      const ax = Math.cos(angle) * 0.23;
      const ay = Math.sin(angle) * 0.23;
      const bx = Math.cos(angle + 0.5) * 0.52;
      const by = Math.sin(angle + 0.5) * 0.52;
      value = Math.max(value, cover(segmentDistance(x, y, ax, ay, bx, by) - 0.042));
    }
    return value;
  },
  pulse(x, y) {
    // A crisp ECG trace, drawn as a polyline rather than a sampled sine.
    const points = [
      [-0.74, 0],
      [-0.3, 0],
      [-0.12, 0.42],
      [0.08, -0.42],
      [0.26, 0],
      [0.74, 0],
    ];
    let distance = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      distance = Math.min(
        distance,
        segmentDistance(
          x,
          y,
          points[index - 1][0],
          points[index - 1][1],
          points[index][0],
          points[index][1],
        ),
      );
    }
    return cover(distance - 0.055);
  },
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function renderMark(glyph, background, ink = '#ffffff') {
  const [br, bg, bb] = hexToRgb(background);
  const [ir, ig, ib] = hexToRgb(ink);

  // One palette entry per antialias level: index 0 is the background, 255 the
  // ink. Indexed colour is what keeps twelve 512px marks ~3 KB each instead of
  // ~25 KB (truecolour has a channel per pixel even where the colour is flat).
  const palette = Array.from({ length: 256 }, (_, step) => {
    const t = step / 255;
    return [
      Math.round(br + (ir - br) * t),
      Math.round(bg + (ig - bg) * t),
      Math.round(bb + (ib - bb) * t),
    ];
  });
  const indices = Buffer.alloc(SIZE * SIZE);

  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      let coverage = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = ((px + (sx + 0.5) / SAMPLES) / SIZE) * 2 - 1;
          const y = ((py + (sy + 0.5) / SAMPLES) / SIZE) * 2 - 1;
          coverage += glyph(x, y);
        }
      }
      coverage /= SAMPLES * SAMPLES;
      indices[py * SIZE + px] = Math.max(0, Math.min(255, Math.round(coverage * 255)));
    }
  }

  return `data:image/png;base64,${encodeIndexedPng(SIZE, SIZE, indices, palette).toString('base64')}`;
}

const PRESETS = [
  {
    id: 'aurora',
    name: 'ART Workspace',
    tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
    taglineEn: 'Manage your workday with ease',
    color: '#0066cc',
    glyph: 'orbit',
  },
  {
    id: 'nova',
    name: 'Nova Team',
    tagline: 'ทำงานเป็นทีมได้ลื่นไหล',
    taglineEn: 'Teamwork that flows',
    color: '#4f46e5',
    glyph: 'peaks',
  },
  {
    id: 'studio',
    name: 'ART Studio',
    tagline: 'พื้นที่สร้างสรรค์ของทีม',
    taglineEn: 'A creative space for your team',
    color: '#7c3aed',
    glyph: 'spark',
  },
  {
    id: 'siam',
    name: 'Siam Workspace',
    tagline: 'ศูนย์รวมทุกงานไว้ในที่เดียว',
    taglineEn: 'Everything in one place',
    color: '#0f766e',
    glyph: 'wave',
  },
  {
    id: 'garden',
    name: 'Green Office',
    tagline: 'ทำงานอย่างเป็นระเบียบทุกวัน',
    taglineEn: 'A tidy workday, every day',
    color: '#15803d',
    glyph: 'bloom',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Labs',
    tagline: 'เริ่มวันใหม่อย่างมีพลัง',
    taglineEn: 'Start the day with energy',
    color: '#c2410c',
    glyph: 'tiles',
  },
  {
    id: 'rose',
    name: 'Rose Desk',
    tagline: 'โต๊ะทำงานที่เป็นของคุณ',
    taglineEn: 'A desk that feels like yours',
    color: '#db2777',
    glyph: 'heart',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    tagline: 'เรียบง่ายแต่ทรงพลัง',
    taglineEn: 'Simple, yet powerful',
    color: '#1d1d1f',
    glyph: 'compass',
  },
  {
    id: 'midnight',
    name: 'Midnight Ops',
    tagline: 'ทำงานข้ามคืนอย่างมีระบบ',
    taglineEn: 'Operations that never sleep',
    color: '#1e3a8a',
    glyph: 'layers',
  },
  {
    id: 'lens',
    name: 'Lens Studio',
    tagline: 'มองภาพรวมของทุกงานชัดขึ้น',
    taglineEn: 'See the whole picture',
    color: '#334155',
    glyph: 'aperture',
  },
  {
    id: 'vita',
    name: 'Vita Clinic',
    tagline: 'ดูแลตารางงานและสุขภาพไปพร้อมกัน',
    taglineEn: 'Work and wellbeing in step',
    color: '#be123c',
    glyph: 'pulse',
  },
  {
    id: 'indigo',
    name: 'Indigo Lab',
    tagline: 'ทดลองไอเดียใหม่ได้ทุกวัน',
    taglineEn: 'Room for a new idea every day',
    color: '#4338ca',
    glyph: 'bolt',
  },
];

const entries = PRESETS.map((preset) => {
  const logo = renderMark(glyphs[preset.glyph], preset.color);
  return `  {
    id: '${preset.id}',
    name: '${preset.name}',
    tagline: '${preset.tagline}',
    taglineEn: '${preset.taglineEn}',
    color: '${preset.color}',
    logo: '${logo}',
  },`;
});

const source = `// GENERATED FILE — run \`node scripts/generate-branding-presets.mjs\` to refresh.
//
// Ready-made name / tagline / logo combinations offered by the branding card.
// Each logo is a 512px PNG data URL, the only image shape the branding endpoints
// accept besides an http(s) link (SVG is refused on purpose: it can carry script).
// 512px is the largest size the PWA icon route serves, so a selected preset is
// never upscaled into a launcher slot.

export interface BrandPreset {
  id: string;
  name: string;
  tagline: string;
  /** English tagline shown when the interface language is English. */
  taglineEn?: string;
  /** Mark background colour, also used for the swatch in the picker. */
  color: string;
  /** PNG data URL, safe to send to the branding / workspace-branding endpoints. */
  logo: string;
}

export const BRAND_PRESETS: BrandPreset[] = [
${entries.join('\n')}
];
`;

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/brandingPresets.ts');
writeFileSync(target, source, 'utf8');
console.log(`wrote ${target} (${(source.length / 1024).toFixed(1)} KB)`);
