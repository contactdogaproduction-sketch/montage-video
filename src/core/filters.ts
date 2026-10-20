import type { ClipFilter, FilterType } from './types';

/**
 * Filtres de couleur, décrits comme une suite d'opérations de dessin par modes de fusion
 * (identiques sur tous les navigateurs : le filtre `ctx.filter` n'existe pas sur Safari iPhone).
 * Le moteur de rendu les applique sur l'image du clip seule, dans l'aperçu comme à l'export.
 */
export const FILTER_TYPES: FilterType[] = ['bw', 'sepia', 'pop', 'film'];

export const FILTER_LABELS: Record<FilterType, string> = {
  bw: 'N&B',
  sepia: 'Sépia',
  pop: 'Pop',
  film: 'Film délavé',
};

export const DEFAULT_FILTER_INTENSITY = 1;

/** Modes de fusion utilisés (noms de `globalCompositeOperation`). */
export type BlendMode = 'saturation' | 'color' | 'soft-light' | 'overlay' | 'lighten' | 'multiply';

export type FilterOperation =
  /** Remplit l'image d'une couleur, fusionnée selon `blend`. */
  | { kind: 'fill'; blend: BlendMode; color: string; alpha: number }
  /** Redessine l'image sur elle-même (contraste). */
  | { kind: 'self'; blend: BlendMode; alpha: number }
  /** Assombrit les bords. */
  | { kind: 'vignette'; alpha: number }
  /** Grain de pellicule, différent à chaque image. */
  | { kind: 'grain'; alpha: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Opérations d'un filtre à une intensité donnée (aucune si l'intensité est nulle). */
export function filterOperations(filter: ClipFilter | null): FilterOperation[] {
  if (!filter) return [];
  const k = clamp01(filter.intensity);
  if (k === 0) return [];
  switch (filter.type) {
    case 'bw':
      return [
        { kind: 'fill', blend: 'saturation', color: '#808080', alpha: k },
        { kind: 'self', blend: 'soft-light', alpha: 0.5 * k },
      ];
    case 'sepia':
      return [
        { kind: 'fill', blend: 'saturation', color: '#808080', alpha: k },
        { kind: 'fill', blend: 'color', color: '#a0703c', alpha: 0.75 * k },
      ];
    case 'pop':
      return [
        { kind: 'fill', blend: 'saturation', color: '#ff0000', alpha: 0.35 * k },
        { kind: 'self', blend: 'soft-light', alpha: 0.7 * k },
      ];
    case 'film':
      return [
        { kind: 'fill', blend: 'saturation', color: '#808080', alpha: 0.3 * k },
        { kind: 'fill', blend: 'soft-light', color: '#ffb066', alpha: 0.35 * k },
        { kind: 'fill', blend: 'lighten', color: '#2e2a26', alpha: k },
        { kind: 'vignette', alpha: 0.55 * k },
        { kind: 'grain', alpha: 0.12 * k },
      ];
  }
}

/** Filtre choisi pour un clip : `null` pour « Aucun ». */
export function makeFilter(type: FilterType | null, intensity: number = DEFAULT_FILTER_INTENSITY): ClipFilter | null {
  return type ? { type, intensity: clamp01(intensity) } : null;
}
