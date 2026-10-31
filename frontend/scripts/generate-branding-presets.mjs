#!/usr/bin/env node
/**
 * Generates `src/lib/brandingPresets.ts`.
 *
 * The branding card offers ready-made name + logo combinations. A preset logo
 * has to survive the same backend validation as an upload, which only accepts
 * an http(s) URL or a base64 PNG/JPEG/GIF/WebP data URL — SVG is refused because
 * it can carry script. So the marks are drawn here on a small canvas and encoded
 * as PNG data URLs, which the sidebar, the profile preview and the favicon all
 * already know how to render.
 *
 * Run with: node scripts/generate-branding-presets.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SIZE = 128;
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

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
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

const glyphs = {
  orbit(x, y) {
    const r = Math.hypot(x, y);
    // A hollow ring with a satellite dot sitting just outside it.
    const ring = cover(Math.abs(r - 0.45) - 0.115);
    const dot = cover(Math.hypot(x - 0.6, y + 0.6) - 0.145);
    return Math.max(ring, dot);
  },
  tiles(x, y) {
    const size = 0.29;
    const rx = x > 0 ? 0.33 : -0.33;
    const ry = y > 0 ? 0.33 : -0.33;
    const block = cover(roundedRect(x - rx, y - ry, size, size, 0.12));
    // One tile is knocked back so the mark reads as a grid, not a solid block.
    return block * (x > 0 && y < 0 ? 0.5 : 1);
  },
  spark(x, y) {
    const star = Math.pow(Math.abs(x), 0.6) + Math.pow(Math.abs(y), 0.6);
    return cover(star - 0.8);
  },
  bars(x, y) {
    const widths = [0.62, 0.46, 0.3];
    let value = 0;
    for (let index = 0; index < 3; index += 1) {
      const centerY = -0.42 + index * 0.42;
      const bar = cover(roundedRect(x - (index - 1) * 0.08, y - centerY, widths[index], 0.105, 0.1));
      value = Math.max(value, bar);
    }
    return value;
  },
  wave(x, y) {
    const line = 0.3 * Math.sin(x * 2.8);
    return cover(Math.abs(y - line) - 0.13) * (Math.abs(x) < 0.86 ? 1 : 0);
  },
  bloom(x, y) {
    const r = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    const edge = 0.44 + 0.24 * Math.abs(Math.cos(3 * angle));
    return cover(Math.abs(r - (edge + 0.44) / 2) - 0.13);
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
  const rgba = Buffer.alloc(SIZE * SIZE * 4);

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

      const index = (py * SIZE + px) * 4;
      rgba[index] = Math.round(br + (ir - br) * coverage);
      rgba[index + 1] = Math.round(bg + (ig - bg) * coverage);
      rgba[index + 2] = Math.round(bb + (ib - bb) * coverage);
      rgba[index + 3] = 255;
    }
  }

  return `data:image/png;base64,${encodePng(SIZE, SIZE, rgba).toString('base64')}`;
}

const PRESETS = [
  {
    id: 'aurora',
    name: 'ART Workspace',
    tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
    color: '#0066cc',
    glyph: 'orbit',
  },
  {
    id: 'nova',
    name: 'Nova Team',
    tagline: 'ทำงานเป็นทีมได้ลื่นไหล',
    color: '#4f46e5',
    glyph: 'peaks',
  },
  {
    id: 'studio',
    name: 'ART Studio',
    tagline: 'พื้นที่สร้างสรรค์ของทีม',
    color: '#7c3aed',
    glyph: 'spark',
  },
  {
    id: 'siam',
    name: 'Siam Workspace',
    tagline: 'ศูนย์รวมทุกงานไว้ในที่เดียว',
    color: '#0f766e',
    glyph: 'wave',
  },
  {
    id: 'garden',
    name: 'Green Office',
    tagline: 'ทำงานอย่างเป็นระเบียบทุกวัน',
    color: '#15803d',
    glyph: 'bloom',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Labs',
    tagline: 'เริ่มวันใหม่อย่างมีพลัง',
    color: '#c2410c',
    glyph: 'tiles',
  },
  {
    id: 'rose',
    name: 'Rose Desk',
    tagline: 'โต๊ะทำงานที่เป็นของคุณ',
    color: '#db2777',
    glyph: 'heart',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    tagline: 'เรียบง่ายแต่ทรงพลัง',
    color: '#1d1d1f',
    glyph: 'bars',
  },
];

const entries = PRESETS.map((preset) => {
  const logo = renderMark(glyphs[preset.glyph], preset.color);
  return `  {
    id: '${preset.id}',
    name: '${preset.name}',
    tagline: '${preset.tagline}',
    color: '${preset.color}',
    logo: '${logo}',
  },`;
});

const source = `// GENERATED FILE — run \`node scripts/generate-branding-presets.mjs\` to refresh.
//
// Ready-made name / tagline / logo combinations offered by the branding card.
// Each logo is a 128px PNG data URL, the only image shape the branding endpoints
// accept besides an http(s) link (SVG is refused on purpose: it can carry script).

export interface BrandPreset {
  id: string;
  name: string;
  tagline: string;
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
