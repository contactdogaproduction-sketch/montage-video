import type { Project, Track, TrackKind } from '../../core/types';

/** Marge à gauche du temps 0, en pixels. */
export const TIMELINE_OFFSET = 16;

export const LANE_HEIGHT: Record<TrackKind, number> = {
  main: 64,
  overlay: 48,
  text: 36,
  sticker: 36,
  audio: 40,
};

/**
 * Ordre d'affichage : pistes visuelles de la plus haute à la plus basse (la principale en bas),
 * puis les pistes audio, comme dans CapCut.
 */
export function displayTracks(project: Project): Track[] {
  const visual = project.tracks.filter((t) => t.kind !== 'audio').reverse();
  const audio = project.tracks.filter((t) => t.kind === 'audio');
  return [...visual, ...audio];
}
