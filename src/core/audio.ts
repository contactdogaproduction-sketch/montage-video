import { clipEnd } from './clip';
import { transitionOverlap } from './transition';
import type { MediaClip, Ms, Track } from './types';

export interface Fades {
  fadeIn: Ms;
  fadeOut: Ms;
}

/** Fondus effectifs : ils ne peuvent pas dépasser, ensemble, la durée du clip. */
export function effectiveFades(clip: MediaClip): Fades {
  const total = clip.fadeIn + clip.fadeOut;
  if (total <= clip.duration || total === 0) return { fadeIn: clip.fadeIn, fadeOut: clip.fadeOut };
  const ratio = clip.duration / total;
  return { fadeIn: Math.round(clip.fadeIn * ratio), fadeOut: Math.round(clip.fadeOut * ratio) };
}

/**
 * Fondus du clip dans sa piste : sur la piste principale, le son se croise pendant les transitions
 * (le fondu couvre au moins la durée du chevauchement avec le clip voisin).
 */
export function trackFades(track: Track, clip: MediaClip): Fades {
  const fades = effectiveFades(clip);
  if (track.kind !== 'main') return fades;
  const index = track.clips.findIndex((c) => c.id === clip.id);
  const previous = track.clips[index - 1];
  const overlapIn = previous ? transitionOverlap(previous, clip) : 0;
  const overlapOut = transitionOverlap(clip, track.clips[index + 1]);
  return { fadeIn: Math.max(fades.fadeIn, overlapIn), fadeOut: Math.max(fades.fadeOut, overlapOut) };
}

/** Gain du clip au temps `t` : volume de la piste × volume du clip × fondus. */
export function clipGainAt(clip: MediaClip, trackVolume: number, t: Ms, fades: Fades = effectiveFades(clip)): number {
  if (t < clip.start || t >= clipEnd(clip)) return 0;
  let fade = 1;
  if (fades.fadeIn > 0) fade = Math.min(fade, (t - clip.start) / fades.fadeIn);
  if (fades.fadeOut > 0) fade = Math.min(fade, (clipEnd(clip) - t) / fades.fadeOut);
  return trackVolume * clip.volume * Math.max(0, Math.min(1, fade));
}
