import { describe, expect, it } from 'vitest';
import { FREEZE_DURATION, freezableClip, insertFreezeFrame } from './freeze';
import { addMedia, createProject, getMainTrack, replaceTrack, setMainMagnet } from './project';
import { IMAGE, VIDEO, mediaClip } from './testUtils';
import { appendClips } from './track';
import type { MediaClip, MediaInfo, Project } from './types';

const FRAME: MediaInfo = { id: 'f', kind: 'image', name: 'figée.jpg', duration: null, width: 1920, height: 1080 };

const project = (): Project => {
  const p = addMedia(createProject('p'), [VIDEO, IMAGE, FRAME]);
  return replaceTrack(
    p,
    appendClips(getMainTrack(p), [mediaClip('a', { duration: 4000, inPoint: 1000, fit: 'cover' }), mediaClip('b', { duration: 2000 })]),
  );
};
const layout = (p: Project) => getMainTrack(p).clips.map((c) => [c.id, c.start, c.duration]);
const ids = { freeze: 'z', rightPart: 'a2' };

describe('figer l’image', () => {
  it('coupe la vidéo au curseur et insère l’image figée en décalant la suite', () => {
    const p = insertFreezeFrame(project(), 'a', 1500, FRAME, ids)!;
    expect(layout(p)).toEqual([
      ['a', 0, 1500],
      ['z', 1500, FREEZE_DURATION],
      ['a2', 3500, 2500],
      ['b', 6000, 2000],
    ]);
    const right = getMainTrack(p).clips[2] as MediaClip;
    expect(right.inPoint).toBe(2500);
    const freeze = getMainTrack(p).clips[1] as MediaClip;
    expect([freeze.mediaId, freeze.fit]).toEqual(['f', 'cover']);
  });
  it('au début d’un clip, l’image figée se place avant lui', () => {
    expect(layout(insertFreezeFrame(project(), 'b', 4000, FRAME, ids)!).map((l) => l[0])).toEqual(['a', 'z', 'b']);
  });
  it('sans aimant, la suite est décalée sans refermer les espaces', () => {
    const p = insertFreezeFrame(setMainMagnet(project(), false), 'a', 1500, FRAME, ids)!;
    expect(layout(p)).toEqual([
      ['a', 0, 1500],
      ['z', 1500, FREEZE_DURATION],
      ['a2', 3500, 2500],
      ['b', 6000, 2000],
    ]);
  });
  it('ne fige qu’une vidéo de la piste principale', () => {
    const p = replaceTrack(project(), appendClips(getMainTrack(project()), [mediaClip('photo', { mediaId: 'i', duration: 1000 })]));
    expect(freezableClip(p, null, 6500)).toBeUndefined();
    expect(freezableClip(p, null, 1000)?.id).toBe('a');
    expect(freezableClip(p, 'b', 4500)?.id).toBe('b');
  });
});
