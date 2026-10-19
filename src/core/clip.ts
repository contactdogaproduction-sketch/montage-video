import type { Clip, MediaInfo, Ms } from './types';

/** Durée minimale d'un clip sur la timeline. */
export const MIN_CLIP_DURATION: Ms = 100;
/** Durée attribuée à une photo lors de son ajout. */
export const IMAGE_DEFAULT_DURATION: Ms = 3000;

export function clipEnd(clip: Clip): Ms {
  return clip.start + clip.duration;
}

/** Temps dans la source correspondant au temps `t` de la timeline. */
export function sourceTimeAt(clip: Clip, t: Ms): Ms {
  return clip.inPoint + (t - clip.start);
}

export function createClip(id: string, media: MediaInfo, start: Ms): Clip {
  return {
    id,
    mediaId: media.id,
    start,
    inPoint: 0,
    duration: media.duration ?? IMAGE_DEFAULT_DURATION,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Déplace le début du clip de `delta` ms (positif = raccourcir).
 * Une vidéo ne peut pas commencer avant le début de sa source ; une image n'a pas de limite.
 */
export function trimStart(clip: Clip, delta: Ms, media: MediaInfo): Clip {
  const maxDelta = clip.duration - MIN_CLIP_DURATION;
  const minDelta = media.duration === null ? -Infinity : -clip.inPoint;
  const d = Math.round(clamp(delta, minDelta, maxDelta));
  if (media.duration === null) {
    return { ...clip, start: clip.start + d, duration: clip.duration - d };
  }
  return { ...clip, start: clip.start + d, inPoint: clip.inPoint + d, duration: clip.duration - d };
}

/** Déplace la fin du clip de `delta` ms (négatif = raccourcir), dans la limite de la source. */
export function trimEnd(clip: Clip, delta: Ms, media: MediaInfo): Clip {
  const maxDuration = media.duration === null ? Infinity : media.duration - clip.inPoint;
  const duration = Math.round(clamp(clip.duration + delta, MIN_CLIP_DURATION, maxDuration));
  return { ...clip, duration };
}

/** Indique si `t` permet de couper le clip en deux parties d'au moins la durée minimale. */
export function canSplitAt(clip: Clip, t: Ms): boolean {
  return t - clip.start >= MIN_CLIP_DURATION && clipEnd(clip) - t >= MIN_CLIP_DURATION;
}

/** Coupe le clip au temps `t` ; la seconde partie reçoit l'identifiant `newId`. */
export function splitClip(clip: Clip, t: Ms, newId: string): [Clip, Clip] | null {
  const at = Math.round(t);
  if (!canSplitAt(clip, at)) return null;
  const leftDuration = at - clip.start;
  const left: Clip = { ...clip, duration: leftDuration };
  const right: Clip = {
    ...clip,
    id: newId,
    start: at,
    inPoint: clip.inPoint + leftDuration,
    duration: clip.duration - leftDuration,
  };
  return [left, right];
}
