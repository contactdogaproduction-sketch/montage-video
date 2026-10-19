import { clipEnd } from './clip';
import type { MediaClip, Ms } from './types';

/** Fondus effectifs : ils ne peuvent pas dépasser, ensemble, la durée du clip. */
export function effectiveFades(clip: MediaClip): { fadeIn: Ms; fadeOut: Ms } {
  const total = clip.fadeIn + clip.fadeOut;
  if (total <= clip.duration || total === 0) return { fadeIn: clip.fadeIn, fadeOut: clip.fadeOut };
  const ratio = clip.duration / total;
  return { fadeIn: Math.round(clip.fadeIn * ratio), fadeOut: Math.round(clip.fadeOut * ratio) };
}

/** Gain du clip au temps `t` : volume de la piste × volume du clip × fondus. */
export function clipGainAt(clip: MediaClip, trackVolume: number, t: Ms): number {
  if (t < clip.start || t >= clipEnd(clip)) return 0;
  const { fadeIn, fadeOut } = effectiveFades(clip);
  let fade = 1;
  if (fadeIn > 0) fade = Math.min(fade, (t - clip.start) / fadeIn);
  if (fadeOut > 0) fade = Math.min(fade, (clipEnd(clip) - t) / fadeOut);
  return trackVolume * clip.volume * Math.max(0, Math.min(1, fade));
}
