import { clipGainAt, trackFades } from './audio';
import { findClipAt } from './track';
import { transitionAt, transitionLayers, type LayerEffect } from './transition';
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

/** Couches visibles au temps `t`, de la plus basse à la plus haute (les pistes audio sont ignorées). */
export function visibleLayers(project: Project, t: Ms): Layer[] {
  const layers: Layer[] = [];
  for (const track of project.tracks) {
    if (track.kind === 'audio') continue;
    const transition = track.kind === 'main' ? transitionAt(track, t) : null;
    if (transition) {
      const toSlot: SourceSlot = sameMedia(transition.from, transition.to) ? 1 : 0;
      for (const layer of transitionLayers(transition.transition.type, transition.progress)) {
        const clip = layer.which === 'from' ? transition.from : transition.to;
        layers.push({ track, clip, slot: layer.which === 'to' ? toSlot : 0, effect: layer.effect });
      }
      continue;
    }
    const clip = findClipAt(track, t);
    if (clip) layers.push({ track, clip, slot: 0, effect: null });
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
    const current = transition ? null : findClipAt(track, t);
    const clips: { clip: Clip; slot: SourceSlot }[] = transition
      ? [
          { clip: transition.from, slot: 0 },
          { clip: transition.to, slot: sameMedia(transition.from, transition.to) ? 1 : 0 },
        ]
      : current
        ? [{ clip: current, slot: 0 }]
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
