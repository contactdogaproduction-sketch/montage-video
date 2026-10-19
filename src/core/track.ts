import { clipEnd, splitClip, trimEnd, trimStart } from './clip';
import type { Clip, MediaInfo, Ms, Track } from './types';

/** Accole les clips depuis 0, dans leur ordre. */
export function packClips(clips: Clip[]): Clip[] {
  let cursor = 0;
  return clips.map((clip) => {
    const packed = clip.start === cursor ? clip : { ...clip, start: cursor };
    cursor += clip.duration;
    return packed;
  });
}

/** Applique les invariants de la piste (piste principale : clips accolés sans trou). */
export function normalizeTrack(track: Track): Track {
  switch (track.kind) {
    case 'main':
      return { ...track, clips: packClips(track.clips) };
  }
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

export function appendClips(track: Track, clips: Clip[]): Track {
  return normalizeTrack({ ...track, clips: [...track.clips, ...clips] });
}

export function removeClip(track: Track, clipId: string): Track {
  return normalizeTrack({ ...track, clips: track.clips.filter((clip) => clip.id !== clipId) });
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

/** Insère une copie du clip juste après lui. */
export function duplicateClipInTrack(track: Track, clipId: string, newId: string): Track | null {
  const index = track.clips.findIndex((clip) => clip.id === clipId);
  const clip = track.clips[index];
  if (!clip) return null;
  const clips = [...track.clips];
  clips.splice(index + 1, 0, { ...clip, id: newId, start: clipEnd(clip) });
  return normalizeTrack({ ...track, clips });
}

export type TrimEdge = 'start' | 'end';

export function trimClipInTrack(
  track: Track,
  clipId: string,
  edge: TrimEdge,
  delta: Ms,
  media: MediaInfo,
): Track {
  const clips = track.clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    return edge === 'start' ? trimStart(clip, delta, media) : trimEnd(clip, delta, media);
  });
  return normalizeTrack({ ...track, clips });
}
