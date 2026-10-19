import { CENTERED, clipEnd } from './clip';
import {
  findClip,
  hasRoom,
  insertClip,
  insertInMainAt,
  removeClip,
  replaceClip,
  splitClipInTrack,
  trackEnd,
  trimClipInTrack,
  type TrimEdge,
} from './track';
import type { Clip, MediaInfo, Ms, Project, Track, TrackKind } from './types';

export const MAIN_TRACK_ID = 'main';

export function createTrack(id: string, kind: TrackKind): Track {
  return { id, kind, clips: [], volume: 1 };
}

export function createProject(id: string): Project {
  return {
    id,
    name: 'Nouveau projet',
    width: 1080,
    height: 1920,
    fps: 30,
    media: {},
    tracks: [createTrack(MAIN_TRACK_ID, 'main')],
  };
}

export function getMainTrack(project: Project): Track {
  const track = project.tracks.find((t) => t.kind === 'main');
  if (!track) throw new Error('Le projet ne contient pas de piste principale.');
  return track;
}

export function getTrack(project: Project, trackId: string): Track | undefined {
  return project.tracks.find((t) => t.id === trackId);
}

export function replaceTrack(project: Project, track: Track): Project {
  return { ...project, tracks: project.tracks.map((t) => (t.id === track.id ? track : t)) };
}

export function addMedia(project: Project, media: MediaInfo[]): Project {
  const next = { ...project.media };
  for (const m of media) next[m.id] = m;
  return { ...project, media: next };
}

export function getMedia(project: Project, mediaId: string): MediaInfo {
  const media = project.media[mediaId];
  if (!media) throw new Error(`Média introuvable : ${mediaId}`);
  return media;
}

export function projectDuration(project: Project): Ms {
  return project.tracks.reduce((end, track) => Math.max(end, trackEnd(track)), 0);
}

/** Nombre d'images à rendre pour couvrir toute la durée du projet. */
export function frameCount(project: Project): number {
  return Math.ceil((projectDuration(project) * project.fps) / 1000);
}

export interface ClipLocation {
  track: Track;
  clip: Clip;
}

export function findClipLocation(project: Project, clipId: string): ClipLocation | undefined {
  for (const track of project.tracks) {
    const clip = findClip(track, clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

/** Durée de la source d'un clip vidéo ou audio ; `null` si sa durée est libre (photo, texte, sticker). */
export function clipSourceDuration(project: Project, clip: Clip): Ms | null {
  return clip.type === 'media' ? getMedia(project, clip.mediaId).duration : null;
}

/** Type de piste libre qui accueille ce clip. */
export function trackKindFor(project: Project, clip: Clip): Exclude<TrackKind, 'main'> {
  switch (clip.type) {
    case 'media':
      return getMedia(project, clip.mediaId).kind === 'audio' ? 'audio' : 'overlay';
    case 'text':
      return 'text';
    case 'sticker':
      return 'sticker';
  }
}

/** Vrai si la piste peut accueillir ce clip (vidéos et photos passent de la principale aux incrustations). */
export function canHost(project: Project, track: Track, clip: Clip): boolean {
  const kind = trackKindFor(project, clip);
  return track.kind === kind || (track.kind === 'main' && kind === 'overlay');
}

/** Supprime les pistes libres devenues vides. */
export function pruneEmptyTracks(project: Project): Project {
  const tracks = project.tracks.filter((t) => t.kind === 'main' || t.clips.length > 0);
  return tracks.length === project.tracks.length ? project : { ...project, tracks };
}

/** Insère une piste juste au-dessus de `belowId` (ou tout en haut). */
function addTrackAbove(project: Project, track: Track, belowId?: string): Project {
  const index = belowId ? project.tracks.findIndex((t) => t.id === belowId) : -1;
  const tracks = [...project.tracks];
  if (index < 0) tracks.push(track);
  else tracks.splice(index + 1, 0, track);
  return { ...project, tracks };
}

/**
 * Place un clip sur une piste libre à `clip.start` : la piste préférée si elle convient et a la place,
 * sinon la première piste compatible libre à cet endroit, sinon une nouvelle piste `newTrackId`.
 */
export function placeClip(project: Project, clip: Clip, newTrackId: string, preferredTrackId?: string): Project {
  const kind = trackKindFor(project, clip);
  const compatible = project.tracks.filter((t) => t.kind === kind);
  const preferred = compatible.find((t) => t.id === preferredTrackId);
  const candidates = preferred ? [preferred, ...compatible.filter((t) => t !== preferred)] : compatible;
  const target = candidates.find((t) => hasRoom(t, clip.start, clip.duration));
  if (target) return replaceTrack(project, insertClip(target, clip));
  return addTrackAbove(project, { ...createTrack(newTrackId, kind), clips: [clip] }, preferredTrackId);
}

export function updateClip(project: Project, clipId: string, update: (clip: Clip) => Clip): Project {
  const location = findClipLocation(project, clipId);
  if (!location) return project;
  return replaceTrack(project, replaceClip(location.track, update(location.clip)));
}

export function setTrackVolume(project: Project, trackId: string, volume: number): Project {
  const track = getTrack(project, trackId);
  return track ? replaceTrack(project, { ...track, volume }) : project;
}

export function removeClipFromProject(project: Project, clipId: string): Project {
  const location = findClipLocation(project, clipId);
  if (!location) return project;
  return pruneEmptyTracks(replaceTrack(project, removeClip(location.track, clipId)));
}

export function splitClipInProject(project: Project, clipId: string, t: Ms, newId: string): Project | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const track = splitClipInTrack(location.track, clipId, t, newId);
  return track ? replaceTrack(project, track) : null;
}

/**
 * Duplique un clip juste après lui. Sur une piste libre sans place, la copie va
 * sur une autre piste compatible ou sur une nouvelle piste `newTrackId`.
 */
export function duplicateClipInProject(project: Project, clipId: string, newId: string, newTrackId: string): Project | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const { track, clip } = location;
  const copy: Clip = { ...clip, id: newId, start: clipEnd(clip) };
  if (track.kind === 'main') return replaceTrack(project, insertInMainAt(track, copy, copy.start));
  if (hasRoom(track, copy.start, copy.duration)) return replaceTrack(project, insertClip(track, copy));
  return placeClip(project, copy, newTrackId, track.id);
}

export function trimClipInProject(project: Project, clipId: string, edge: TrimEdge, delta: Ms): Project {
  const location = findClipLocation(project, clipId);
  if (!location) return project;
  const source = clipSourceDuration(project, location.clip);
  return replaceTrack(project, trimClipInTrack(location.track, clipId, edge, delta, source));
}

export type MoveTarget = { trackId: string } | { newTrackId: string; aboveTrackId?: string };

/**
 * Déplace un clip vers `start` sur la piste cible.
 * - Piste principale : le clip s'insère à l'endroit le plus proche (son centre fait foi).
 * - Piste libre occupée à cet endroit : une nouvelle piste est créée juste au-dessus.
 * Renvoie `null` si la piste cible ne peut pas accueillir ce clip.
 */
export function moveClip(project: Project, clipId: string, target: MoveTarget, start: Ms, spareTrackId: string): Project | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const { clip } = location;
  const position = Math.max(0, Math.round(start));
  const without = replaceTrack(project, removeClip(location.track, clipId));

  if ('newTrackId' in target) {
    const kind = trackKindFor(project, clip);
    const track = { ...createTrack(target.newTrackId, kind), clips: [{ ...clip, start: position }] };
    return pruneEmptyTracks(addTrackAbove(without, track, target.aboveTrackId));
  }

  const destination = getTrack(without, target.trackId);
  if (!destination || !canHost(project, destination, clip)) return null;

  if (destination.kind === 'main') {
    const entering: Clip = clip.type === 'media' && location.track.kind !== 'main' ? { ...clip, transform: CENTERED } : clip;
    const track = insertInMainAt(destination, entering, position + clip.duration / 2);
    return pruneEmptyTracks(replaceTrack(without, track));
  }

  const moved: Clip = { ...clip, start: position };
  if (hasRoom(destination, moved.start, moved.duration)) {
    return pruneEmptyTracks(replaceTrack(without, insertClip(destination, moved)));
  }
  const kind = trackKindFor(project, clip);
  const track = { ...createTrack(spareTrackId, kind), clips: [moved] };
  return pruneEmptyTracks(addTrackAbove(without, track, destination.id));
}
