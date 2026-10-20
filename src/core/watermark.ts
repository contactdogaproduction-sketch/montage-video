import type { Project, WatermarkCorner } from './types';

/** Logo en filigrane dans un coin de la vidéo (aperçu et export). */
export const WATERMARK_CORNERS: WatermarkCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export const WATERMARK_LABELS: Record<WatermarkCorner, string> = {
  'top-left': 'Haut gauche',
  'top-right': 'Haut droite',
  'bottom-left': 'Bas gauche',
  'bottom-right': 'Bas droite',
};

/** Coin par défaut : en haut à gauche, hors des boutons et légendes de TikTok et Reels. */
export const DEFAULT_WATERMARK: WatermarkCorner = 'top-left';
/** Largeur du logo, en fraction du petit côté du cadre. */
export const WATERMARK_SIZE = 0.14;
/** Marge au bord, en fraction du petit côté du cadre. */
export const WATERMARK_MARGIN = 0.05;
export const WATERMARK_OPACITY = 0.85;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Emplacement du logo dans le cadre (pixels du projet), ou `null` sans filigrane (ou projet vide).
 * `aspect` : largeur / hauteur du logo.
 */
export function watermarkRect(project: Project, aspect: number): Rect | null {
  if (!project.watermark || aspect <= 0) return null;
  if (project.tracks.every((track) => track.clips.length === 0)) return null;
  const side = Math.min(project.width, project.height);
  const width = side * WATERMARK_SIZE;
  const height = width / aspect;
  const margin = side * WATERMARK_MARGIN;
  const left = project.watermark.endsWith('left');
  const top = project.watermark.startsWith('top');
  return {
    x: left ? margin : project.width - margin - width,
    y: top ? margin : project.height - margin - height,
    width,
    height,
  };
}
