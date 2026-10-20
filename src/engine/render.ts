import { animatedTextTransform } from '../core/animation';
import { visibleLayers, type Layer } from '../core/composition';
import { filterOperations, type FilterOperation } from '../core/filters';
import { cssFont } from '../core/fonts';
import { fitContain, fitCover } from '../core/geometry';
import { transformAtTime } from '../core/keyframes';
import type { LayerEffect } from '../core/transition';
import type { Clip, ClipFilter, MediaInfo, Ms, Project, StickerClip, TextClip, Transform } from '../core/types';

/** Côté du carré de base d'un sticker, en pixels du cadre (échelle 1). */
export const STICKER_BASE = 320;
const LINE_HEIGHT = 1.2;
const EMOJI_FONT = `${Math.round(STICKER_BASE * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
/** Réduction maximale de l'image pour le flou (1 / 24 de la taille au flou maximal). */
const BLUR_STRENGTH = 23;

/**
 * Fournit l'image source d'une couche (élément vidéo positionné, image chargée), ou `null` si indisponible.
 * `layer.slot` distingue les deux lecteurs d'une même vidéo pendant une transition.
 */
export type SourceResolver = (layer: Layer, media: MediaInfo) => CanvasImageSource | null;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let measureContext: CanvasRenderingContext2D | null = null;

function measure(): CanvasRenderingContext2D {
  if (!measureContext) {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    measureContext = ctx;
  }
  return measureContext;
}

function textLines(text: string): string[] {
  return text.split('\n');
}

/** Taille d'un élément à l'échelle 1, en pixels du cadre. */
export function baseSize(project: Project, clip: Clip): { width: number; height: number } {
  switch (clip.type) {
    case 'media': {
      const media = project.media[clip.mediaId];
      if (!media || media.kind === 'audio') return { width: 0, height: 0 };
      const fit = clip.fit === 'cover' ? fitCover : fitContain;
      const rect = fit(media.width, media.height, project.width, project.height);
      return { width: rect.width, height: rect.height };
    }
    case 'sticker': {
      if (clip.source.kind === 'emoji') return { width: STICKER_BASE, height: STICKER_BASE };
      const media = project.media[clip.source.mediaId];
      if (!media) return { width: 0, height: 0 };
      const rect = fitContain(media.width, media.height, STICKER_BASE, STICKER_BASE);
      return { width: rect.width, height: rect.height };
    }
    case 'text': {
      const ctx = measure();
      ctx.font = cssFont(clip.style.font, clip.style.size);
      const lines = textLines(clip.text);
      const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + clip.style.strokeWidth * 2;
      return { width, height: lines.length * clip.style.size * LINE_HEIGHT + clip.style.strokeWidth * 2 };
    }
  }
}

/** Cadre d'un élément dans le repère du projet : centre, taille mise à l'échelle, rotation en degrés. */
export interface ElementBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
}

export function elementBox(project: Project, clip: Clip, transform: Transform): ElementBox {
  const { width, height } = baseSize(project, clip);
  return {
    cx: transform.x * project.width,
    cy: transform.y * project.height,
    width: width * transform.scale,
    height: height * transform.scale,
    rotation: transform.rotation,
  };
}

function containsPoint(box: ElementBox, x: number, y: number): boolean {
  const angle = (-box.rotation * Math.PI) / 180;
  const dx = x - box.cx;
  const dy = y - box.cy;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2;
}

/** Élément visible le plus haut sous le point (x, y) du projet. */
export function hitTest(project: Project, t: Ms, x: number, y: number): Clip | null {
  const layers = visibleLayers(project, t);
  for (let i = layers.length - 1; i >= 0; i--) {
    const clip = layers[i]?.clip;
    if (clip && containsPoint(elementBox(project, clip, transformAtTime(clip, t)), x, y)) return clip;
  }
  return null;
}

/** Placement courant d'un élément : keyframes, et animations d'entrée et de sortie pour le texte. */
export function transformAt(clip: Clip, t: Ms): Transform {
  return clip.type === 'text' ? animatedTextTransform(clip, t) : transformAtTime(clip, t);
}

function withTransform(ctx: Context2D, project: Project, transform: Transform, effect: LayerEffect | null, draw: () => void): void {
  ctx.save();
  ctx.translate((transform.x + (effect?.offsetX ?? 0)) * project.width, transform.y * project.height);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  const scale = transform.scale * (effect?.scale ?? 1);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity * (effect?.opacity ?? 1)));
  draw();
  ctx.restore();
}

let blurCanvas: HTMLCanvasElement | null = null;

/**
 * Flou par réduction puis agrandissement de l'image : identique sur tous les navigateurs
 * (le filtre `ctx.filter` n'existe pas sur Safari iPhone).
 */
function drawImageBlurred(ctx: Context2D, source: CanvasImageSource, width: number, height: number, amount: number): void {
  if (amount < 0.01) {
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    return;
  }
  blurCanvas ??= document.createElement('canvas');
  const factor = 1 / (1 + amount * BLUR_STRENGTH);
  blurCanvas.width = Math.max(1, Math.round(width * factor));
  blurCanvas.height = Math.max(1, Math.round(height * factor));
  const small = blurCanvas.getContext('2d');
  if (!small) return;
  small.imageSmoothingQuality = 'high';
  small.drawImage(source, 0, 0, blurCanvas.width, blurCanvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blurCanvas, -width / 2, -height / 2, width, height);
}

let filterCanvas: HTMLCanvasElement | null = null;
let grainTile: HTMLCanvasElement | null = null;
/** Côté du motif de grain, en pixels. */
const GRAIN_SIZE = 128;
/** Copies superposées pour le flou de mouvement du balayage. */
const MOTION_COPIES = 8;

/** Pixels réels par unité du repère courant. */
function deviceScale(ctx: Context2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/** Motif de grain : bruit gris, calculé une seule fois. */
function grain(): HTMLCanvasElement | null {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = GRAIN_SIZE;
  tile.height = GRAIN_SIZE;
  const g = tile.getContext('2d');
  if (!g) return null;
  const image = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  // Générateur pseudo-aléatoire fixe : le même grain dans l'aperçu et à l'export.
  let seed = 12345;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = (seed >> 8) & 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  grainTile = tile;
  return tile;
}

function applyOperation(f: CanvasRenderingContext2D, canvas: HTMLCanvasElement, op: FilterOperation, t: Ms): void {
  const { width, height } = canvas;
  f.globalAlpha = op.alpha;
  switch (op.kind) {
    case 'fill':
      f.globalCompositeOperation = op.blend;
      f.fillStyle = op.color;
      f.fillRect(0, 0, width, height);
      break;
    case 'self':
      f.globalCompositeOperation = op.blend;
      f.drawImage(canvas, 0, 0);
      break;
    case 'vignette': {
      const radius = Math.hypot(width, height) / 2;
      const gradient = f.createRadialGradient(width / 2, height / 2, radius * 0.45, width / 2, height / 2, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      f.globalCompositeOperation = 'source-over';
      f.fillStyle = gradient;
      f.fillRect(0, 0, width, height);
      break;
    }
    case 'grain': {
      const tile = grain();
      const pattern = tile ? f.createPattern(tile, 'repeat') : null;
      if (!pattern) break;
      // Grain différent à chaque image de la vidéo (30 par seconde), identique d'un rendu à l'autre.
      const frame = Math.floor(t / (1000 / 30));
      f.save();
      f.translate((frame * 37) % GRAIN_SIZE, (frame * 61) % GRAIN_SIZE);
      f.globalCompositeOperation = 'overlay';
      f.fillStyle = pattern;
      f.fillRect(-GRAIN_SIZE, -GRAIN_SIZE, width + GRAIN_SIZE, height + GRAIN_SIZE);
      f.restore();
      break;
    }
  }
}

/**
 * Image du clip avec son filtre (et le flou de transition), calculée à la résolution de
 * l'écran ou de l'export, sur un canvas à part : le filtre ne touche pas ce qui est dessous.
 */
function filteredImage(ctx: Context2D, source: CanvasImageSource, width: number, height: number, blur: number, ops: FilterOperation[], t: Ms): CanvasImageSource {
  filterCanvas ??= document.createElement('canvas');
  const scale = deviceScale(ctx);
  filterCanvas.width = Math.max(1, Math.min(4096, Math.ceil(width * scale)));
  filterCanvas.height = Math.max(1, Math.min(4096, Math.ceil(height * scale)));
  const f = filterCanvas.getContext('2d');
  if (!f) return source;
  f.setTransform(filterCanvas.width / width, 0, 0, filterCanvas.height / height, filterCanvas.width / 2, filterCanvas.height / 2);
  drawImageBlurred(f, source, width, height, blur);
  f.setTransform(1, 0, 0, 1, 0, 0);
  for (const op of ops) applyOperation(f, filterCanvas, op, t);
  // Les couleurs ajoutées ne doivent pas déborder sur les parties transparentes (PNG).
  if (!(source instanceof HTMLVideoElement)) {
    f.globalAlpha = 1;
    f.globalCompositeOperation = 'destination-in';
    f.drawImage(source, 0, 0, filterCanvas.width, filterCanvas.height);
  }
  f.globalAlpha = 1;
  f.globalCompositeOperation = 'source-over';
  return filterCanvas;
}

/**
 * Image d'une vidéo ou d'une photo : filtre, flou de transition, et flou de mouvement
 * (`streak` : longueur de la traînée, dans le repère de l'élément).
 */
function drawMedia(ctx: Context2D, source: CanvasImageSource, width: number, height: number, blur: number, filter: ClipFilter | null, streak: number, t: Ms): void {
  const ops = filterOperations(filter);
  const image = ops.length > 0 ? filteredImage(ctx, source, width, height, blur, ops, t) : source;
  const remainingBlur = ops.length > 0 ? 0 : blur;
  if (streak <= 0) {
    drawImageBlurred(ctx, image, width, height, remainingBlur);
    return;
  }
  // Flou de mouvement : copies décalées, moyennées (chaque copie pèse 1/n de l'image finale).
  const alpha = ctx.globalAlpha;
  for (let i = 0; i < MOTION_COPIES; i++) {
    const dx = (i / (MOTION_COPIES - 1) - 0.5) * streak;
    ctx.globalAlpha = alpha / (i + 1);
    ctx.drawImage(image, -width / 2 + dx, -height / 2, width, height);
  }
  ctx.globalAlpha = alpha;
}

function drawText(ctx: Context2D, clip: TextClip): void {
  const { style } = clip;
  const lines = textLines(clip.text);
  const lineHeight = style.size * LINE_HEIGHT;
  ctx.font = cssFont(style.font, style.size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineHeight;
    if (style.strokeWidth > 0) {
      // Le trait est centré sur le contour : le double de l'épaisseur, la moitié intérieure étant recouverte.
      ctx.lineWidth = style.strokeWidth * 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(line, 0, y);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, 0, y);
  });
}

function drawEmoji(ctx: Context2D, emoji: string): void {
  ctx.font = EMOJI_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 0);
}

/**
 * Images des textes et des emojis déjà dessinés, pour l'aperçu : dessiner un texte avec un gros
 * contour est coûteux sur téléphone, alors que recopier une image ne l'est pas. Chaque image est
 * calculée à la résolution de l'écran (et au double, au quadruple… pour les agrandissements).
 */
export class SpriteCache {
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  /** Pixels de l'écran par pixel du cadre. */
  pixelScale = 1;

  constructor(private readonly capacity = 24) {}

  /** Dessine l'élément centré sur l'origine, depuis le cache si possible. */
  draw(ctx: Context2D, key: string, width: number, height: number, resolution: number, paint: (target: Context2D) => void): void {
    // Résolution arrondie à la puissance de 2 supérieure : peu de variantes pendant un zoom animé.
    const level = 2 ** Math.ceil(Math.log2(Math.max(1, resolution)));
    const pixels = Math.min(level, 4) * this.pixelScale;
    const id = `${key}|${pixels}`;
    let sprite = this.sprites.get(id);
    if (sprite) {
      this.sprites.delete(id);
    } else {
      sprite = document.createElement('canvas');
      sprite.width = Math.max(1, Math.ceil(width * pixels));
      sprite.height = Math.max(1, Math.ceil(height * pixels));
      const target = sprite.getContext('2d');
      if (!target) return;
      target.setTransform(pixels, 0, 0, pixels, sprite.width / 2, sprite.height / 2);
      paint(target);
    }
    this.sprites.set(id, sprite);
    // Taille exacte de l'image (arrondie au pixel) : pas de rééchantillonnage qui adoucirait le texte.
    const w = sprite.width / pixels;
    const h = sprite.height / pixels;
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    for (const [oldest, old] of this.sprites) {
      if (this.sprites.size <= this.capacity) break;
      // Safari libère la mémoire d'un canvas seulement quand sa taille est remise à zéro.
      old.width = 0;
      old.height = 0;
      this.sprites.delete(oldest);
    }
  }
  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.width = 0;
      sprite.height = 0;
    }
    this.sprites.clear();
  }
}

/** Marge autour d'un texte dans son image (jambages et boucles des polices manuscrites). */
const TEXT_MARGIN = 0.5;

function drawTextCached(ctx: Context2D, project: Project, clip: TextClip, resolution: number, sprites: SpriteCache): void {
  const { style } = clip;
  const { width, height } = baseSize(project, clip);
  const margin = style.size * TEXT_MARGIN;
  const key = `t|${style.font}|${style.size}|${style.color}|${style.strokeColor}|${style.strokeWidth}|${clip.text}`;
  sprites.draw(ctx, key, width + margin * 2, height + margin * 2, resolution, (target) => drawText(target, clip));
}

function drawSticker(ctx: Context2D, project: Project, layer: Layer, clip: StickerClip, resolve: SourceResolver, resolution: number, sprites?: SpriteCache): void {
  if (clip.source.kind === 'emoji') {
    const { emoji } = clip.source;
    if (sprites) sprites.draw(ctx, `e|${emoji}`, STICKER_BASE * 1.2, STICKER_BASE * 1.2, resolution, (target) => drawEmoji(target, emoji));
    else drawEmoji(ctx, emoji);
    return;
  }
  const media = project.media[clip.source.mediaId];
  const source = media ? resolve(layer, media) : null;
  if (!source) return;
  const { width, height } = baseSize(project, clip);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
}

/**
 * Dessine l'image du projet au temps `t`, dans le repère du projet (width × height).
 * Partagé par l'aperçu et l'export : ce qu'on voit est ce qu'on exporte.
 * `sprites` (aperçu) : textes et emojis recopiés depuis un cache ; l'export les dessine directement.
 */
export function drawFrame(ctx: Context2D, project: Project, t: Ms, resolve: SourceResolver, sprites?: SpriteCache): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, project.width, project.height);
  for (const layer of visibleLayers(project, t)) {
    const { clip, effect } = layer;
    const transform = transformAt(clip, t);
    switch (clip.type) {
      case 'media': {
        const media = project.media[clip.mediaId];
        if (!media || media.kind === 'audio') break;
        const source = resolve(layer, media);
        if (!source) break;
        const { width, height } = baseSize(project, clip);
        const scale = transform.scale * (effect?.scale ?? 1);
        const streak = scale > 0 ? ((effect?.motionBlur ?? 0) * project.width) / scale : 0;
        withTransform(ctx, project, transform, effect, () => drawMedia(ctx, source, width, height, effect?.blur ?? 0, clip.filter, streak, t));
        break;
      }
      case 'sticker': {
        const resolution = transform.scale * (effect?.scale ?? 1);
        withTransform(ctx, project, transform, effect, () => drawSticker(ctx, project, layer, clip, resolve, resolution, sprites));
        break;
      }
      case 'text': {
        if (clip.text.trim() === '') break;
        const resolution = transform.scale * (effect?.scale ?? 1);
        withTransform(ctx, project, transform, effect, () => (sprites ? drawTextCached(ctx, project, clip, resolution, sprites) : drawText(ctx, clip)));
        break;
      }
    }
    if (effect && effect.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, effect.flash);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, project.width, project.height);
      ctx.restore();
    }
  }
}

/** Miniature d'une image avec un filtre (choix du filtre dans les réglages du clip). */
export function drawFilterPreview(canvas: HTMLCanvasElement, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, filter: ClipFilter | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Image recadrée pour remplir la miniature.
  const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  ctx.setTransform(1, 0, 0, 1, canvas.width / 2, canvas.height / 2);
  drawMedia(ctx, source, width, height, 0, filter, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
