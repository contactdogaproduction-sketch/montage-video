import { easeInOut } from './keyframes';
import type { Clip, MediaClip, Ms, Project, Track, Transition, TransitionType } from './types';

export const MIN_TRANSITION: Ms = 200;
export const MAX_TRANSITION: Ms = 2000;
export const DEFAULT_TRANSITION: Ms = 500;

export const TRANSITION_TYPES: TransitionType[] = ['fade', 'fade-black', 'slide', 'zoom', 'blur', 'flash', 'whip', 'cutout'];

/** Durée maximale d'une transition entre deux clips : la moitié du plus court, sans dépasser 2 s. */
export function maxTransitionDuration(previous: Clip, next: Clip): Ms {
  return Math.min(MAX_TRANSITION, Math.floor(Math.min(previous.duration, next.duration) / 2));
}

/** Chevauchement effectif entre deux clips consécutifs de la piste principale. */
export function transitionOverlap(previous: Clip, next: Clip | undefined): Ms {
  if (!next || previous.type !== 'media' || !previous.transition) return 0;
  return Math.max(0, Math.min(previous.transition.duration, maxTransitionDuration(previous, next)));
}

/**
 * Chevauchement réellement disponible : sur une piste principale aimantée, celui de la transition ;
 * sans aimant, une transition n'agit que si les deux clips se touchent.
 */
export function effectiveOverlap(previous: Clip, next: Clip | undefined): Ms {
  if (!next) return 0;
  return Math.max(0, Math.min(transitionOverlap(previous, next), previous.start + previous.duration - next.start));
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
    const overlap = effectiveOverlap(from, to);
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
  /** Voile blanc posé sur tout le cadre après cette couche, de 0 à 1 (flash). */
  flash: number;
  /** Longueur du flou de mouvement horizontal, en fraction de la largeur du cadre (balayage). */
  motionBlur: number;
  /** Seule la personne détourée est dessinée (le décor est retiré). */
  cutout: boolean;
}

const NEUTRAL: LayerEffect = { opacity: 1, offsetX: 0, scale: 1, blur: 0, flash: 0, motionBlur: 0, cutout: false };

/** Part de la transition « détourage » pendant laquelle le décor défile (la personne s'efface ensuite). */
export const CUTOUT_SWEEP = 0.7;

/** Accélération puis décélération marquées : mouvement très rapide au milieu (balayage). */
export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

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
    case 'flash': {
      // Le cadre blanchit jusqu'au milieu, où l'on passe au clip suivant, puis le blanc s'efface.
      const flash = easeInOut(1 - Math.abs(2 * p - 1));
      return p < 0.5 ? [{ which: 'from', effect: { ...NEUTRAL, flash } }] : [{ which: 'to', effect: { ...NEUTRAL, flash } }];
    }
    case 'whip': {
      // Balayage : les deux images filent vers la gauche, floutées par la vitesse.
      const move = easeInOutCubic(p);
      const motionBlur = 0.35 * Math.sin(Math.PI * p);
      return [
        { which: 'from', effect: { ...NEUTRAL, offsetX: -move, motionBlur } },
        { which: 'to', effect: { ...NEUTRAL, offsetX: 1 - move, motionBlur } },
      ];
    }
    case 'cutout': {
      // La personne du premier clip reste devant pendant que le décor file vers la gauche et
      // laisse place au clip suivant ; elle s'efface ensuite.
      const sweep = Math.min(1, p / CUTOUT_SWEEP);
      const move = easeInOutCubic(sweep);
      const motionBlur = 0.25 * Math.sin(Math.PI * sweep);
      const fadeOut = p <= CUTOUT_SWEEP ? 1 : 1 - (p - CUTOUT_SWEEP) / (1 - CUTOUT_SWEEP);
      return [
        { which: 'from', effect: { ...NEUTRAL, offsetX: -move, motionBlur } },
        { which: 'to', effect: { ...NEUTRAL, offsetX: 1 - move, motionBlur } },
        { which: 'from', effect: { ...NEUTRAL, cutout: true, opacity: fadeOut } },
      ];
    }
  }
}

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: 'Fondu',
  'fade-black': 'Fondu au noir',
  slide: 'Glissement',
  zoom: 'Zoom',
  blur: 'Flou',
  flash: 'Flash blanc',
  whip: 'Balayage flou',
  cutout: 'Détourage + balayage',
};

/** Vrai si le projet a besoin du détourage (arrière-plan supprimé ou transition « détourage »). */
export function usesCutout(project: Project): boolean {
  return project.tracks.some((track) =>
    track.clips.some((clip) => clip.type === 'media' && (clip.removeBackground || clip.transition?.type === 'cutout')),
  );
}
