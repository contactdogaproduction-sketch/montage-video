import { clipEnd } from './clip';
import type { Ms, TextAnimation, TextClip, Transform } from './types';

/** Durée d'une animation d'entrée ou de sortie de texte. */
export const TEXT_ANIMATION_MS: Ms = 400;
/** Décalage vertical du glissement, en fraction de la hauteur du cadre. */
const SLIDE_OFFSET = 0.08;
/** Échelle de départ du zoom. */
const ZOOM_FROM = 0.5;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

function applyAnimation(transform: Transform, animation: TextAnimation, progress: number): Transform {
  if (animation === 'none' || progress >= 1) return transform;
  const p = easeOutCubic(progress);
  switch (animation) {
    case 'fade':
      return { ...transform, opacity: transform.opacity * p };
    case 'slide':
      return { ...transform, y: transform.y + (1 - p) * SLIDE_OFFSET, opacity: transform.opacity * p };
    case 'zoom':
      return { ...transform, scale: transform.scale * (ZOOM_FROM + (1 - ZOOM_FROM) * p), opacity: transform.opacity * p };
  }
}

/** Placement du texte au temps `t`, animations d'entrée et de sortie comprises. */
export function animatedTextTransform(clip: TextClip, t: Ms): Transform {
  const length = Math.min(TEXT_ANIMATION_MS, clip.duration / 2);
  const inProgress = clamp01((t - clip.start) / length);
  const outProgress = clamp01((clipEnd(clip) - t) / length);
  return applyAnimation(applyAnimation(clip.transform, clip.animationIn, inProgress), clip.animationOut, outProgress);
}
