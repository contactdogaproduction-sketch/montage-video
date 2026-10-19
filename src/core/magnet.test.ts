import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import {
  addMedia,
  changeClipSpeed,
  createProject,
  duplicateClipInProject,
  getMainTrack,
  moveClip,
  replaceTrack,
  setMainMagnet,
  trimClipInProject,
} from './project';
import { VIDEO, mediaClip } from './testUtils';
import { appendClips } from './track';
import { transitionAt } from './transition';
import type { Project } from './types';

const layout = (p: Project) => getMainTrack(p).clips.map((c) => [c.id, c.start, c.duration]);

/** Piste principale : a (0–2 s), b (2–4 s), aimant désactivé. */
const free = (): Project => {
  const p = addMedia(createProject('p'), [VIDEO]);
  const withClips = replaceTrack(p, appendClips(getMainTrack(p), [mediaClip('a', { duration: 2000 }), mediaClip('b', { duration: 2000 })]));
  return setMainMagnet(withClips, false);
};

describe('aimant de la piste principale', () => {
  it('est activé par défaut, y compris pour les projets enregistrés avant', () => {
    expect(getMainTrack(createProject('p')).magnetic).toBe(true);
    expect(getMainTrack(migrateProject({ id: 'p', tracks: [{ id: 'main', kind: 'main', clips: [] }] }, 'f')).magnetic).toBe(true);
  });
  it('désactivé : raccourcir un clip laisse un espace au lieu de décaler la suite', () => {
    expect(layout(trimClipInProject(free(), 'a', 'end', -500))).toEqual([
      ['a', 0, 1500],
      ['b', 2000, 2000],
    ]);
  });
  it('désactivé : un clip se place librement dans un espace, et se refuse sur un autre clip', () => {
    const spaced = moveClip(free(), 'b', { trackId: 'main' }, 3000, 'x')!;
    expect(layout(spaced)).toEqual([
      ['a', 0, 2000],
      ['b', 3000, 2000],
    ]);
    expect(moveClip(spaced, 'b', { trackId: 'main' }, 1000, 'x')).toBeNull();
  });
  it('désactivé : une vidéo importée va après le dernier clip, espaces compris', () => {
    const spaced = moveClip(free(), 'b', { trackId: 'main' }, 3000, 'x')!;
    const p = replaceTrack(spaced, appendClips(getMainTrack(spaced), [mediaClip('c', { duration: 1000 })]));
    expect(layout(p).at(-1)).toEqual(['c', 5000, 1000]);
  });
  it('désactivé : une copie sans place va en fin de piste', () => {
    expect(layout(duplicateClipInProject(free(), 'a', 'a2', 'x')!).at(-1)).toEqual(['a2', 4000, 2000]);
  });
  it('désactivé : ralentir un clip sans place après lui ne change rien', () => {
    const p = free();
    expect(changeClipSpeed(p, 'a', 0.5, 'x')).toBe(p);
  });
  it('désactivé : une transition n’agit qu’entre deux clips qui se touchent', () => {
    let p = free();
    p = replaceTrack(p, { ...getMainTrack(p), clips: getMainTrack(p).clips.map((c) => (c.id === 'a' && c.type === 'media' ? { ...c, transition: { type: 'fade' as const, duration: 500 } } : c)) });
    expect(transitionAt(getMainTrack(p), 2100)).toBeNull();
    const spaced = moveClip(p, 'b', { trackId: 'main' }, 3000, 'x')!;
    expect(transitionAt(getMainTrack(spaced), 3100)).toBeNull();
  });
  it('réactivé : les espaces sont refermés', () => {
    const spaced = moveClip(free(), 'b', { trackId: 'main' }, 3000, 'x')!;
    expect(layout(setMainMagnet(spaced, true))).toEqual([
      ['a', 0, 2000],
      ['b', 2000, 2000],
    ]);
  });
});
