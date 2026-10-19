import { shiftKeyframes, splitKeyframes } from './keyframes';
import type { Clip, MediaClip, MediaInfo, Ms, StickerClip, StickerSource, TextClip, Transform } from './types';

/** Durée minimale d'un clip sur la timeline. */
export const MIN_CLIP_DURATION: Ms = 100;
/** Durée attribuée à une photo, un texte ou un sticker lors de son ajout. */
export const IMAGE_DEFAULT_DURATION: Ms = 3000;
export const MAX_VOLUME = 2;

export const CENTERED: Transform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 };

export function clipEnd(clip: Clip): Ms {
  return clip.start + clip.duration;
}

/** Temps dans la source correspondant au temps `t` de la timeline. */
export function sourceTimeAt(clip: MediaClip, t: Ms): Ms {
  return clip.inPoint + (t - clip.start);
}

export function createMediaClip(id: string, media: MediaInfo, start: Ms, transform: Transform = CENTERED): MediaClip {
  return {
    type: 'media',
    id,
    mediaId: media.id,
    start,
    inPoint: 0,
    duration: media.duration ?? IMAGE_DEFAULT_DURATION,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform,
    keyframes: [],
    transition: null,
  };
}

export function createTextClip(id: string, start: Ms, text = 'Votre texte'): TextClip {
  return {
    type: 'text',
    id,
    start,
    duration: IMAGE_DEFAULT_DURATION,
    text,
    style: { font: 'montserrat', size: 96, color: '#ffffff', strokeColor: '#000000', strokeWidth: 8 },
    transform: CENTERED,
    keyframes: [],
    animationIn: 'none',
    animationOut: 'none',
  };
}

export function createStickerClip(id: string, start: Ms, source: StickerSource): StickerClip {
  return { type: 'sticker', id, start, duration: IMAGE_DEFAULT_DURATION, source, transform: CENTERED, keyframes: [] };
}

/** Identifiant du média utilisé par un clip, s'il y en a un. */
export function clipMediaId(clip: Clip): string | null {
  if (clip.type === 'media') return clip.mediaId;
  if (clip.type === 'sticker' && clip.source.kind === 'image') return clip.source.mediaId;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Déplace le début du clip de `delta` ms (positif = raccourcir).
 * `sourceDuration` : durée de la source pour une vidéo ou un audio (le début ne peut pas précéder
 * celui de la source) ; `null` pour une photo, un texte ou un sticker (durée libre).
 * `minStart` : le clip ne peut pas commencer avant ce temps (voisin précédent, début de la timeline).
 * Les keyframes restent au même endroit de la timeline.
 */
export function trimStart(clip: Clip, delta: Ms, sourceDuration: Ms | null, minStart: Ms = -Infinity): Clip {
  const usesSource = clip.type === 'media' && sourceDuration !== null;
  const minDelta = Math.max(usesSource ? -clip.inPoint : -Infinity, minStart - clip.start);
  const d = Math.round(clamp(delta, minDelta, clip.duration - MIN_CLIP_DURATION));
  const start = clip.start + d;
  const duration = clip.duration - d;
  const keyframes = shiftKeyframes(clip.keyframes, -d);
  if (clip.type === 'media' && usesSource) return { ...clip, start, duration, keyframes, inPoint: clip.inPoint + d };
  return { ...clip, start, duration, keyframes };
}

/** Déplace la fin du clip de `delta` ms (négatif = raccourcir), dans la limite de la source et de `maxEnd`. */
export function trimEnd(clip: Clip, delta: Ms, sourceDuration: Ms | null, maxEnd: Ms = Infinity): Clip {
  const sourceMax = clip.type === 'media' && sourceDuration !== null ? sourceDuration - clip.inPoint : Infinity;
  const maxDuration = Math.min(sourceMax, maxEnd - clip.start);
  const duration = Math.round(clamp(clip.duration + delta, MIN_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, maxDuration)));
  return { ...clip, duration };
}

/** Indique si `t` permet de couper le clip en deux parties d'au moins la durée minimale. */
export function canSplitAt(clip: Clip, t: Ms): boolean {
  return t - clip.start >= MIN_CLIP_DURATION && clipEnd(clip) - t >= MIN_CLIP_DURATION;
}

/**
 * Coupe le clip au temps `t` ; la seconde partie reçoit l'identifiant `newId`.
 * Les fondus, animations et la transition restent aux extrémités ; les keyframes sont réparties
 * avec une keyframe ajoutée à la coupe de chaque côté (mouvement continu).
 */
export function splitClip(clip: Clip, t: Ms, newId: string): [Clip, Clip] | null {
  const at = Math.round(t);
  if (!canSplitAt(clip, at)) return null;
  const leftDuration = at - clip.start;
  const rightDuration = clip.duration - leftDuration;
  const [leftKeyframes, rightKeyframes] = splitKeyframes(clip.keyframes, clip.transform, leftDuration);
  const left = { duration: leftDuration, keyframes: leftKeyframes };
  const right = { id: newId, start: at, duration: rightDuration, keyframes: rightKeyframes };
  switch (clip.type) {
    case 'media':
      return [
        { ...clip, ...left, fadeOut: 0, transition: null },
        { ...clip, ...right, inPoint: clip.inPoint + leftDuration, fadeIn: 0 },
      ];
    case 'text':
      return [
        { ...clip, ...left, animationOut: 'none' },
        { ...clip, ...right, animationIn: 'none' },
      ];
    case 'sticker':
      return [
        { ...clip, ...left },
        { ...clip, ...right },
      ];
  }
}
