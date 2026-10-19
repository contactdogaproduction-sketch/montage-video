import { clipEnd, splitClip, trimEnd, trimStart } from './clip';
import type { Clip, Ms, Track } from './types';

/** Piste où les clips sont placés librement (toutes sauf la principale). */
export function isFreeTrack(track: Track): boolean {
  return track.kind !== 'main';
}

/** Accole les clips depuis 0, dans leur ordre. */
export function packClips(clips: Clip[]): Clip[] {
  let cursor = 0;
  return clips.map((clip) => {
    const packed = clip.start === cursor ? clip : { ...clip, start: cursor };
    cursor += clip.duration;
    return packed;
  });
}

/** Applique les invariants de la piste : principale accolée sans trou, autres triées par début. */
export function normalizeTrack(track: Track): Track {
  if (track.kind === 'main') return { ...track, clips: packClips(track.clips) };
  return { ...track, clips: [...track.clips].sort((a, b) => a.start - b.start) };
}

export function trackEnd(track: Track): Ms {
  return track.clips.reduce((end, clip) => Math.max(end, clipEnd(clip)), 0);
}

/** Clip présent au temps `t` (début inclus, fin exclue). */
export function findClipAt(track: Track, t: Ms): Clip | undefined {
  return track.clips.find((clip) => clip.start <= t && t < clipEnd(clip));
}

export function findClip(track: Track, clipId: string): Clip | undefined {
  return track.clips.find((clip) => clip.id === clipId);
}

/** Vrai si l'intervalle [start, start + duration[ est libre sur une piste libre. */
export function hasRoom(track: Track, start: Ms, duration: Ms, ignoreId?: string): boolean {
  if (start < 0) return false;
  const end = start + duration;
  return track.clips.every((clip) => clip.id === ignoreId || end <= clip.start || start >= clipEnd(clip));
}

export function appendClips(track: Track, clips: Clip[]): Track {
  return normalizeTrack({ ...track, clips: [...track.clips, ...clips] });
}

/** Ajoute un clip à sa position (piste libre) ; l'appelant vérifie la place avec `hasRoom`. */
export function insertClip(track: Track, clip: Clip): Track {
  return normalizeTrack({ ...track, clips: [...track.clips, clip] });
}

/** Insère un clip dans la piste principale à l'endroit le plus proche du temps `t`. */
export function insertInMainAt(track: Track, clip: Clip, t: Ms): Track {
  const index = track.clips.filter((c) => c.start + c.duration / 2 < t).length;
  const clips = [...track.clips];
  clips.splice(index, 0, clip);
  return normalizeTrack({ ...track, clips });
}

export function removeClip(track: Track, clipId: string): Track {
  return normalizeTrack({ ...track, clips: track.clips.filter((clip) => clip.id !== clipId) });
}

export function replaceClip(track: Track, clip: Clip): Track {
  return normalizeTrack({ ...track, clips: track.clips.map((c) => (c.id === clip.id ? clip : c)) });
}

/** Coupe le clip `clipId` au temps `t`. Renvoie `null` si la coupe est impossible. */
export function splitClipInTrack(track: Track, clipId: string, t: Ms, newId: string): Track | null {
  const index = track.clips.findIndex((clip) => clip.id === clipId);
  const clip = track.clips[index];
  if (!clip) return null;
  const parts = splitClip(clip, t, newId);
  if (!parts) return null;
  const clips = [...track.clips];
  clips.splice(index, 1, ...parts);
  return normalizeTrack({ ...track, clips });
}

/** Espace libre autour d'un clip : fin du clip précédent et début du suivant (pistes libres). */
export function freeBounds(track: Track, clipId: string): { minStart: Ms; maxEnd: Ms } {
  if (!isFreeTrack(track)) return { minStart: -Infinity, maxEnd: Infinity };
  const clip = findClip(track, clipId);
  if (!clip) return { minStart: 0, maxEnd: Infinity };
  let minStart = 0;
  let maxEnd = Infinity;
  for (const other of track.clips) {
    if (other.id === clipId) continue;
    if (clipEnd(other) <= clip.start) minStart = Math.max(minStart, clipEnd(other));
    else if (other.start >= clipEnd(clip)) maxEnd = Math.min(maxEnd, other.start);
  }
  return { minStart, maxEnd };
}

export type TrimEdge = 'start' | 'end';

/**
 * Trim d'un bord. Piste principale : les clips suivants se décalent.
 * Piste libre : le bord s'arrête contre le clip voisin.
 */
export function trimClipInTrack(
  track: Track,
  clipId: string,
  edge: TrimEdge,
  delta: Ms,
  sourceDuration: Ms | null,
): Track {
  const { minStart, maxEnd } = freeBounds(track, clipId);
  const clips = track.clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    return edge === 'start'
      ? trimStart(clip, delta, sourceDuration, minStart)
      : trimEnd(clip, delta, sourceDuration, maxEnd);
  });
  return normalizeTrack({ ...track, clips });
}
