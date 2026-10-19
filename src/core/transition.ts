import { easeInOut } from './keyframes';
import type { Clip, MediaClip, Ms, Track, Transition, TransitionType } from './types';

export const MIN_TRANSITION: Ms = 200;
export const MAX_TRANSITION: Ms = 2000;
export const DEFAULT_TRANSITION: Ms = 500;

export const TRANSITION_TYPES: TransitionType[] = ['fade', 'fade-black', 'slide', 'zoom', 'blur'];

/** Durée maximale d'une transition entre deux clips : la moitié du plus court, sans dépasser 2 s. */
export function maxTransitionDuration(previous: Clip, next: Clip): Ms {
  return Math.min(MAX_TRANSITION, Math.floor(Math.min(previous.duration, next.duration) / 2));
}

/** Chevauchement effectif entre deux clips consécutifs de la piste principale. */
export function transitionOverlap(previous: Clip, next: Clip | undefined): Ms {
  if (!next || previous.type !== 'media' || !previous.transition) return 0;
  return Math.max(0, Math.min(previous.transition.duration, maxTransitionDuration(previous, next)));
}

export interface TransitionState {
  from: MediaClip;
  to: Clip;
  transition: Transition;
  /** Avancement de 0 (début) à 1 (fin). */
  progress: number;
}

/** Transition en cours au temps `t` sur la piste principale, s'il y en a une. */
export function transitionAt(track: Track, t: Ms): TransitionState | null {
  for (let i = 0; i < track.clips.length - 1; i++) {
    const from = track.clips[i] as Clip;
    const to = track.clips[i + 1] as Clip;
    const overlap = transitionOverlap(from, to);
    if (overlap === 0 || from.type !== 'media' || !from.transition) continue;
    if (t >= to.start && t < to.start + overlap) {
      return { from, to, transition: from.transition, progress: (t - to.start) / overlap };
    }
  }
  return null;
}

/** Modification d'une couche pendant une transition. */
export interface LayerEffect {
  opacity: number;
  /** Décalage horizontal, en fraction de la largeur du cadre. */
  offsetX: number;
  scale: number;
  /** Intensité du flou, de 0 (net) à 1. */
  blur: number;
}

const NEUTRAL: LayerEffect = { opacity: 1, offsetX: 0, scale: 1, blur: 0 };

export interface TransitionLayer {
  which: 'from' | 'to';
  effect: LayerEffect;
}

/** Couches à dessiner pendant une transition, dans l'ordre (la première en dessous). */
export function transitionLayers(type: TransitionType, progress: number): TransitionLayer[] {
  const p = Math.min(1, Math.max(0, progress));
  const eased = easeInOut(p);
  switch (type) {
    case 'fade':
      return [
        { which: 'from', effect: NEUTRAL },
        { which: 'to', effect: { ...NEUTRAL, opacity: p } },
      ];
    case 'fade-black':
      // Sur fond noir : le premier clip s'éteint pendant la première moitié, le second s'allume ensuite.
      return [
        { which: 'from', effect: { ...NEUTRAL, opacity: Math.max(0, 1 - 2 * p) } },
        { which: 'to', effect: { ...NEUTRAL, opacity: Math.max(0, 2 * p - 1) } },
      ];
    case 'slide':
      return [
        { which: 'from', effect: { ...NEUTRAL, offsetX: -eased } },
        { which: 'to', effect: { ...NEUTRAL, offsetX: 1 - eased } },
      ];
    case 'zoom':
      return [
        { which: 'to', effect: NEUTRAL },
        { which: 'from', effect: { ...NEUTRAL, scale: 1 + 0.5 * eased, opacity: 1 - p } },
      ];
    case 'blur':
      return [
        { which: 'to', effect: { ...NEUTRAL, blur: Math.max(0, 1 - 2 * p) } },
        { which: 'from', effect: { ...NEUTRAL, blur: Math.min(1, 2 * p), opacity: 1 - p } },
      ];
  }
}

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: 'Fondu',
  'fade-black': 'Fondu au noir',
  slide: 'Glissement',
  zoom: 'Zoom',
  blur: 'Flou',
};
