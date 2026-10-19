import { describe, expect, it } from 'vitest';
import {
  appendClips,
  duplicateClipInTrack,
  findClipAt,
  packClips,
  removeClip,
  splitClipInTrack,
  trackEnd,
  trimClipInTrack,
} from './track';
import type { Clip, MediaInfo, Track } from './types';

const video: MediaInfo = { id: 'v', kind: 'video', name: 'v.mp4', duration: 10000, width: 1920, height: 1080 };

const c = (id: string, duration: number, start = 0, inPoint = 0): Clip => ({
  id,
  mediaId: 'v',
  start,
  inPoint,
  duration,
});

const track = (clips: Clip[]): Track => ({ id: 'main', kind: 'main', clips: packClips(clips) });
const starts = (t: Track) => t.clips.map((clip) => [clip.id, clip.start, clip.duration]);

describe('packClips', () => {
  it('accole les clips depuis 0', () => {
    expect(packClips([c('a', 1000, 500), c('b', 2000, 9000)]).map((x) => x.start)).toEqual([0, 1000]);
  });
});

describe('trackEnd / findClipAt', () => {
  const t = track([c('a', 1000), c('b', 2000)]);
  it('calcule la durée de la piste', () => {
    expect(trackEnd(t)).toBe(3000);
    expect(trackEnd(track([]))).toBe(0);
  });
  it('trouve le clip sous le curseur (début inclus, fin exclue)', () => {
    expect(findClipAt(t, 0)?.id).toBe('a');
    expect(findClipAt(t, 999)?.id).toBe('a');
    expect(findClipAt(t, 1000)?.id).toBe('b');
    expect(findClipAt(t, 3000)).toBeUndefined();
  });
});

describe('appendClips', () => {
  it('ajoute à la fin de la piste principale', () => {
    expect(starts(appendClips(track([c('a', 1000)]), [c('b', 500), c('c', 700)]))).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 500],
      ['c', 1500, 700],
    ]);
  });
});

describe('removeClip', () => {
  it('supprime et referme le trou', () => {
    expect(starts(removeClip(track([c('a', 1000), c('b', 2000), c('c', 500)]), 'b'))).toEqual([
      ['a', 0, 1000],
      ['c', 1000, 500],
    ]);
  });
});

describe('splitClipInTrack', () => {
  it('coupe au temps de la timeline', () => {
    const result = splitClipInTrack(track([c('a', 1000), c('b', 4000)]), 'b', 2500, 'b2');
    expect(starts(result!)).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 1500],
      ['b2', 2500, 2500],
    ]);
    expect(result!.clips[2]!.inPoint).toBe(1500);
  });
  it('renvoie null si le temps est hors du clip', () => {
    expect(splitClipInTrack(track([c('a', 1000), c('b', 4000)]), 'a', 2500, 'x')).toBeNull();
  });
  it('conserve la durée totale', () => {
    const t = track([c('a', 1000), c('b', 4000)]);
    expect(trackEnd(splitClipInTrack(t, 'b', 2500, 'x')!)).toBe(trackEnd(t));
  });
});

describe('duplicateClipInTrack', () => {
  it('insère la copie juste après et décale la suite', () => {
    const result = duplicateClipInTrack(track([c('a', 1000, 0, 300), c('b', 2000)]), 'a', 'a2');
    expect(starts(result!)).toEqual([
      ['a', 0, 1000],
      ['a2', 1000, 1000],
      ['b', 2000, 2000],
    ]);
    expect(result!.clips[1]!.inPoint).toBe(300);
  });
});

describe('trimClipInTrack', () => {
  it('raccourcir la fin décale les clips suivants', () => {
    const t = trimClipInTrack(track([c('a', 5000), c('b', 2000)]), 'a', 'end', -2000, video);
    expect(starts(t)).toEqual([
      ['a', 0, 3000],
      ['b', 3000, 2000],
    ]);
  });
  it('raccourcir le début garde le clip accolé à son voisin', () => {
    const t = trimClipInTrack(track([c('a', 1000), c('b', 5000)]), 'b', 'start', 1500, video);
    expect(starts(t)).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 3500],
    ]);
    expect(t.clips[1]!.inPoint).toBe(1500);
  });
  it('allonger le début du premier clip reste possible si la source le permet', () => {
    const t = trimClipInTrack(track([c('a', 3000, 0, 2000)]), 'a', 'start', -1000, video);
    expect(t.clips[0]).toMatchObject({ start: 0, inPoint: 1000, duration: 4000 });
  });
});
