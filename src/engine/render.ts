import { animatedTextTransform } from '../core/animation';
import { cssFont } from '../core/fonts';
import { fitContain } from '../core/geometry';
import { findClipAt } from '../core/track';
import type { Clip, MediaInfo, Ms, Project, StickerClip, TextClip, Track, Transform } from '../core/types';

/** Côté du carré de base d'un sticker, en pixels du cadre (échelle 1). */
export const STICKER_BASE = 320;
const LINE_HEIGHT = 1.2;
const EMOJI_FONT = `${Math.round(STICKER_BASE * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

/** Fournit l'image source d'un média (élément vidéo positionné, image chargée), ou `null` si indisponible. */
export type SourceResolver = (media: MediaInfo) => CanvasImageSource | null;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface VisibleClip {
  track: Track;
  clip: Clip;
}

/** Éléments visibles au temps `t`, de la couche la plus basse à la plus haute (les pistes audio sont ignorées). */
export function visibleClips(project: Project, t: Ms): VisibleClip[] {
  const result: VisibleClip[] = [];
  for (const track of project.tracks) {
    if (track.kind === 'audio') continue;
    const clip = findClipAt(track, t);
    if (clip) result.push({ track, clip });
  }
  return result;
}

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
      const rect = fitContain(media.width, media.height, project.width, project.height);
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

export function elementBox(project: Project, clip: Clip, transform: Transform = clip.transform): ElementBox {
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

/** Élément déplaçable (incrustation, texte, sticker) le plus haut sous le point (x, y) du projet. */
export function hitTest(project: Project, t: Ms, x: number, y: number): Clip | null {
  const candidates = visibleClips(project, t).filter(({ track }) => track.kind !== 'main');
  for (let i = candidates.length - 1; i >= 0; i--) {
    const clip = candidates[i]?.clip;
    if (clip && containsPoint(elementBox(project, clip), x, y)) return clip;
  }
  return null;
}

/** Placement courant d'un élément (animations de texte comprises). */
export function transformAt(clip: Clip, t: Ms): Transform {
  return clip.type === 'text' ? animatedTextTransform(clip, t) : clip.transform;
}

function withTransform(ctx: Context2D, project: Project, transform: Transform, draw: () => void): void {
  ctx.save();
  ctx.translate(transform.x * project.width, transform.y * project.height);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.scale, transform.scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  draw();
  ctx.restore();
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

function drawSticker(ctx: Context2D, project: Project, clip: StickerClip, resolve: SourceResolver): void {
  if (clip.source.kind === 'emoji') {
    ctx.font = EMOJI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.source.emoji, 0, 0);
    return;
  }
  const media = project.media[clip.source.mediaId];
  const source = media ? resolve(media) : null;
  if (!source) return;
  const { width, height } = baseSize(project, clip);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
}

/**
 * Dessine l'image du projet au temps `t`, dans le repère du projet (width × height).
 * Partagé par l'aperçu et l'export : ce qu'on voit est ce qu'on exporte.
 */
export function drawFrame(ctx: Context2D, project: Project, t: Ms, resolve: SourceResolver): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, project.width, project.height);
  for (const { clip } of visibleClips(project, t)) {
    const transform = transformAt(clip, t);
    switch (clip.type) {
      case 'media': {
        const media = project.media[clip.mediaId];
        if (!media || media.kind === 'audio') break;
        const source = resolve(media);
        if (!source) break;
        const { width, height } = baseSize(project, clip);
        withTransform(ctx, project, transform, () => ctx.drawImage(source, -width / 2, -height / 2, width, height));
        break;
      }
      case 'sticker':
        withTransform(ctx, project, transform, () => drawSticker(ctx, project, clip, resolve));
        break;
      case 'text':
        if (clip.text.trim() !== '') withTransform(ctx, project, transform, () => drawText(ctx, clip));
        break;
    }
  }
}
