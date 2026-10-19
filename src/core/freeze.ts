import { MIN_CLIP_DURATION, canSplitAt, clipEnd, createMediaClip, splitClip } from './clip';
import { transformAtTime } from './keyframes';
import { findClipLocation, getMainTrack, replaceTrack } from './project';
import { isFreeTrack, normalizeTrack } from './track';
import type { Clip, MediaClip, MediaInfo, Ms, Project } from './types';

/** Durée d'une image figée à sa création (ajustable ensuite comme une photo). */
export const FREEZE_DURATION: Ms = 2000;

/** Clip vidéo de la piste principale que « Figer » utiliserait au temps `t`, s'il y en a un. */
export function freezableClip(project: Project, selectedClipId: string | null, t: Ms): MediaClip | undefined {
  const main = getMainTrack(project);
  const isVideoAt = (clip: Clip | undefined): clip is MediaClip =>
    clip !== undefined && clip.type === 'media' && clip.start <= t && t < clipEnd(clip) && project.media[clip.mediaId]?.kind === 'video';
  const selected = selectedClipId ? main.clips.find((c) => c.id === selectedClipId) : undefined;
  if (isVideoAt(selected)) return selected;
  // Pendant une transition, deux clips se chevauchent : on prend le dernier commencé.
  return [...main.clips].reverse().find(isVideoAt);
}

/**
 * Insère l'image figée `frame` (photo de la vidéo au temps `t`) dans la piste principale :
 * la vidéo est coupée au temps `t` et la suite est décalée de la durée de l'image figée.
 * L'image garde le cadrage et le placement de la vidéo à cet instant.
 */
export function insertFreezeFrame(
  project: Project,
  clipId: string,
  t: Ms,
  frame: MediaInfo,
  ids: { freeze: string; rightPart: string },
): Project | null {
  const location = findClipLocation(project, clipId);
  if (!location || location.track.kind !== 'main' || location.clip.type !== 'media') return null;
  const { track, clip } = location;

  // Point d'insertion : coupe au curseur, ou juste avant/après le clip si le curseur est sur un bord.
  let at = Math.round(t);
  let parts: Clip[] = [clip];
  if (canSplitAt(clip, at)) parts = splitClip(clip, at, ids.rightPart) ?? [clip];
  else at = at - clip.start < MIN_CLIP_DURATION ? clip.start : clipEnd(clip);

  const freeze: MediaClip = {
    ...createMediaClip(ids.freeze, frame, at, transformAtTime(clip, t)),
    duration: FREEZE_DURATION,
    fit: clip.fit,
  };

  const index = track.clips.findIndex((c) => c.id === clipId);
  const before = track.clips.slice(0, index);
  const after = track.clips.slice(index + 1);
  const left = parts.length === 2 ? [parts[0] as Clip] : at === clip.start ? [] : [clip];
  const right = parts.length === 2 ? [parts[1] as Clip] : at === clip.start ? [clip] : [];
  // Piste sans aimant : tout ce qui suit l'image figée est décalé de sa durée.
  const shift = (c: Clip): Clip => (isFreeTrack(track) && c.start >= at ? { ...c, start: c.start + FREEZE_DURATION } : c);
  const clips = [...before, ...left, freeze, ...[...right, ...after].map(shift)];
  return replaceTrack(project, normalizeTrack({ ...track, clips }));
}
