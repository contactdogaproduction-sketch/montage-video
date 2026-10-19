// Génère les icônes PNG de l'application (PWA, écran d'accueil iPhone) sans dépendance.
// Usage : node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ACCENT = [79, 70, 229];
const WHITE = [255, 255, 255];
const SUPERSAMPLE = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits par canal
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Point (x, y) dans le carré arrondi de côté 1 (rayon r), ou partout si `fullBleed`. */
function inBackground(x, y, r, fullBleed) {
  if (fullBleed) return true;
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return dx * dx + dy * dy <= r * r;
}

/** Triangle « lecture » centré, légèrement décalé à droite pour l'équilibre visuel. */
function inPlay(x, y, scale) {
  const cx = 0.5 + 0.04 * scale;
  const h = 0.36 * scale;
  const w = h * 0.9;
  const left = cx - w / 2;
  if (x < left || x > left + w) return false;
  const half = (h / 2) * (1 - (x - left) / w);
  return Math.abs(y - 0.5) <= half;
}

function render(size, { fullBleed = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  // Icône « maskable » : le symbole reste dans la zone sûre centrale (80 %).
  const scale = fullBleed ? 0.8 : 1;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!inBackground(x, y, 0.22, fullBleed)) continue;
          bg++;
          if (inPlay(x, y, scale)) fg++;
        }
      }
      const total = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = bg / total;
      const mix = bg === 0 ? 0 : fg / bg;
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(ACCENT[c] * (1 - mix) + WHITE[c] * mix);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', render(192));
writeFileSync('public/icon-512.png', render(512));
writeFileSync('public/icon-maskable-512.png', render(512, { fullBleed: true }));
// iPhone : icône pleine (iOS arrondit lui-même les angles, la transparence deviendrait noire).
writeFileSync('public/apple-touch-icon.png', render(180, { fullBleed: true }));
console.log('Icônes générées dans public/.');
