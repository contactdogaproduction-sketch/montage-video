import { trackEnd } from './track';
import type { MediaInfo, Ms, Project, Track } from './types';

export const MAIN_TRACK_ID = 'main';

export function createProject(id: string): Project {
  return {
    id,
    name: 'Nouveau projet',
    width: 1080,
    height: 1920,
    fps: 30,
    media: {},
    tracks: [{ id: MAIN_TRACK_ID, kind: 'main', clips: [] }],
  };
}

export function getMainTrack(project: Project): Track {
  const track = project.tracks.find((t) => t.kind === 'main');
  if (!track) throw new Error('Le projet ne contient pas de piste principale.');
  return track;
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
