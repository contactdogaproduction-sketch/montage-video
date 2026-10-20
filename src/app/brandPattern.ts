import { loadLogo } from '../engine/logo';

/** Côté du motif, en pixels CSS (dessiné au double pour les écrans haute densité). */
const TILE = 240;
const LOGO_SIZE = 42;
const LOGO_ALPHA = 0.1;
const CHEVRON_SIZE = 15;
const CHEVRON_ALPHA = 0.08;
const ACCENT = '#4f46e5';

/** Double chevron, rappel de la pointe du logo. */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  for (const offset of [0, 6]) {
    ctx.beginPath();
    ctx.moveTo(x - CHEVRON_SIZE, y - CHEVRON_SIZE / 2 + offset);
    ctx.lineTo(x, y + CHEVRON_SIZE / 2 + offset);
    ctx.lineTo(x + CHEVRON_SIZE, y - CHEVRON_SIZE / 2 + offset);
    ctx.stroke();
  }
}

/**
 * Motif de fond de l'application : le logo en petit, en quinconce avec des chevrons, très discret.
 * Calculé au démarrage à partir du logo et exposé en variable CSS (`--brand-pattern`).
 */
export async function applyBrandPattern(): Promise<void> {
  const logo = await loadLogo();
  if (!logo) return;
  const canvas = document.createElement('canvas');
  canvas.width = TILE * 2;
  canvas.height = TILE * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(2, 2);
  ctx.imageSmoothingQuality = 'high';
  const quarter = TILE / 4;
  ctx.globalAlpha = LOGO_ALPHA;
  for (const [x, y] of [
    [quarter, quarter],
    [3 * quarter, 3 * quarter],
  ] as const) {
    ctx.drawImage(logo, x - LOGO_SIZE / 2, y - LOGO_SIZE / 2, LOGO_SIZE, LOGO_SIZE);
  }
  ctx.globalAlpha = CHEVRON_ALPHA;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  chevron(ctx, 3 * quarter, quarter);
  chevron(ctx, quarter, 3 * quarter);
  document.documentElement.style.setProperty('--brand-pattern', `url(${canvas.toDataURL('image/png')})`);
}
