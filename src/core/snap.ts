import { clipEnd } from './clip';
import type { Ms, Project } from './types';

/** Points d'aimantation : début de la timeline, curseur, bords des autres clips. */
export function snapPoints(project: Project, excludeClipId: string | null, playhead: Ms): Ms[] {
  const points = new Set<Ms>([0, Math.round(playhead)]);
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      points.add(clip.start);
      points.add(clipEnd(clip));
    }
  }
  return [...points];
}

/** Point le plus proche de `t` à moins de `threshold`, sinon `null`. */
export function snapValue(t: Ms, points: Ms[], threshold: Ms): Ms | null {
  let best: Ms | null = null;
  let bestDistance = threshold;
  for (const p of points) {
    const distance = Math.abs(p - t);
    if (distance <= bestDistance) {
      best = p;
      bestDistance = distance;
    }
  }
  return best;
}

export interface SnappedMove {
  start: Ms;
  /** Point d'aimantation utilisé (pour l'afficher), ou `null`. */
  snappedTo: Ms | null;
}

/** Aimante le début ou la fin d'un clip déplacé, selon le bord le plus proche d'un point. */
export function snapMove(start: Ms, duration: Ms, points: Ms[], threshold: Ms): SnappedMove {
  const byStart = snapValue(start, points, threshold);
  const byEnd = snapValue(start + duration, points, threshold);
  const startDistance = byStart === null ? Infinity : Math.abs(byStart - start);
  const endDistance = byEnd === null ? Infinity : Math.abs(byEnd - (start + duration));
  if (byStart !== null && startDistance <= endDistance) return { start: byStart, snappedTo: byStart };
  if (byEnd !== null) return { start: byEnd - duration, snappedTo: byEnd };
  return { start, snappedTo: null };
}
