/**
 * Renders the launcher icons from the app mark.
 *
 * The icons are committed PNGs, not generated at request time: an installed app
 * asks for them at exact sizes and must never receive an upscaled bitmap (the
 * old single 192px file stretched to 512 was why the launcher icon looked soft).
 *
 *   node scripts/generate-app-icons.mjs
 *
 * `any` icons keep the rounded-square shape; maskable and Apple variants are
 * full-bleed so the launcher's own crop cannot shave the mark.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const ARTWORK = `
  <g fill="#fff">
    <rect x="112" y="112" width="156" height="288" rx="28"/>
    <rect x="284" y="112" width="116" height="140" rx="28"/>
    <rect x="284" y="268" width="116" height="132" rx="28"/>
  </g>`;

const ROUNDED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0066cc"/>${ARTWORK}
</svg>`;

const FULL_BLEED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0066cc"/>${ARTWORK}
</svg>`;

const TARGETS = [
  { file: 'icon-192.png', size: 192, svg: ROUNDED },
  { file: 'icon-512.png', size: 512, svg: ROUNDED },
  { file: 'icon-maskable-192.png', size: 192, svg: FULL_BLEED },
  { file: 'icon-maskable-512.png', size: 512, svg: FULL_BLEED },
  { file: 'apple-touch-icon.png', size: 180, svg: FULL_BLEED },
];

await mkdir(PUBLIC, { recursive: true });

for (const { file, size, svg } of TARGETS) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(PUBLIC, file), png);
  console.log(`${file} ${size}x${size} ${(png.length / 1024).toFixed(1)}KB`);
}

// Keep the openable SVG mark in sync with the rasterised artwork.
const markPath = path.join(PUBLIC, 'workspace-mark.svg');
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">
  <title id="title">Workspace</title>
  <rect width="512" height="512" rx="112" fill="#0066cc"/>${ARTWORK}
</svg>
`;
if ((await readFile(markPath, 'utf8').catch(() => '')) !== mark) {
  await writeFile(markPath, mark);
}
