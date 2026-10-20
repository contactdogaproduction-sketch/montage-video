import { clipGainAt, trackFades } from './audio';
import { clipEnd } from './clip';
import { transitionAt, transitionLayers, type LayerEffect, type TransitionState } from './transition';
import type { Clip, MediaClip, Ms, Project, Track } from './types';

/**
 * Lecteur utilisé pour un média : deux moments d'une même vidéo peuvent être visibles
 * en même temps (transition entre deux morceaux d'une vidéo coupée), d'où deux lecteurs possibles.
 */
export type SourceSlot = 0 | 1;

export interface Layer {
  track: Track;
  clip: Clip;
  slot: SourceSlot;
  /** Effet de transition appliqué à cette couche, ou `null`. */
  effect: LayerEffect | null;
}

const sameMedia = (a: Clip, b: Clip) => a.type === 'media' && b.type === 'media' && a.mediaId === b.mediaId;

/**
 * Lecteur du clip n° `index` de la piste : deux clips qui se suivent sur une piste et viennent
 * d'une même source alternent entre les deux lecteurs. Le suivant peut ainsi être prêt à sa
 * première image pendant que le précédent joue (coupe sans attente), et les deux sont visibles
 * ensemble pendant une transition.
 */
export function clipSlot(track: Track, index: number): SourceSlot {
  let slot: SourceSlot = 0;
  for (let i = 1; i <= index; i++) {
    const previous = track.clips[i - 1];
    const clip = track.clips[i];
    slot = previous && clip && sameMedia(previous, clip) ? (slot === 0 ? 1 : 0) : 0;
  }
  return slot;
}

/** Clip en cours sur la piste au temps `t`, avec son lecteur. */
function clipAt(track: Track, t: Ms): { clip: Clip; slot: SourceSlot } | null {
  const index = track.clips.findIndex((clip) => clip.start <= t && t < clipEnd(clip));
  const clip = track.clips[index];
  return clip ? { clip, slot: clipSlot(track, index) } : null;
}

/** Les deux clips d'une transition, avec leurs lecteurs. */
function transitionClips(track: Track, transition: TransitionState): { from: SourceSlot; to: SourceSlot } {
  const index = track.clips.indexOf(transition.from);
  return { from: clipSlot(track, index), to: clipSlot(track, index + 1) };
}

/** Couches visibles au temps `t`, de la plus basse à la plus haute (les pistes audio sont ignorées). */
export function visibleLayers(project: Project, t: Ms): Layer[] {
  const layers: Layer[] = [];
  for (const track of project.tracks) {
    if (track.kind === 'audio') continue;
    const transition = track.kind === 'main' ? transitionAt(track, t) : null;
    if (transition) {
      const slots = transitionClips(track, transition);
      for (const layer of transitionLayers(transition.transition.type, transition.progress)) {
        const clip = layer.which === 'from' ? transition.from : transition.to;
        layers.push({ track, clip, slot: slots[layer.which], effect: layer.effect });
      }
      continue;
    }
    const current = clipAt(track, t);
    if (current) layers.push({ track, clip: current.clip, slot: current.slot, effect: null });
  }
  return layers;
}

export interface AudibleClip {
  track: Track;
  clip: MediaClip;
  slot: SourceSlot;
  /** Gain à appliquer (volumes, fondus et fondu croisé des transitions). */
  gain: number;
}

/** Clips vidéo et audio en cours au temps `t` (les deux pendant une transition), piste principale en premier. */
export function activeMediaClips(project: Project, t: Ms): AudibleClip[] {
  const result: AudibleClip[] = [];
  for (const track of project.tracks) {
    const transition = track.kind === 'main' ? transitionAt(track, t) : null;
    const slots = transition ? transitionClips(track, transition) : null;
    const current = transition ? null : clipAt(track, t);
    const clips: { clip: Clip; slot: SourceSlot }[] =
      transition && slots
        ? [
            { clip: transition.from, slot: slots.from },
            { clip: transition.to, slot: slots.to },
          ]
        : current
          ? [current]
          : [];
    for (const { clip, slot } of clips) {
      if (clip.type !== 'media') continue;
      const media = project.media[clip.mediaId];
      if (!media || media.kind === 'image') continue;
      result.push({ track, clip, slot, gain: clipGainAt(clip, track.volume, t, trackFades(track, clip)) });
    }
  }
  return result;
}
