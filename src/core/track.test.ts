import { describe, expect, it } from 'vitest';
import {
  appendClips,
  findClipAt,
  freeBounds,
  hasRoom,
  insertInMainAt,
  normalizeTrack,
  packClips,
  removeClip,
  splitClipInTrack,
  trackEnd,
  trimClipInTrack,
} from './track';
import { mediaClip, stickerClip, track } from './testUtils';
import type { Clip, MediaClip, Track } from './types';

const c = (id: string, duration: number, start = 0, inPoint = 0) => mediaClip(id, { duration, start, inPoint });
const main = (clips: Clip[]): Track => track('main', 'main', packClips(clips));
const layout = (t: Track) => t.clips.map((clip) => [clip.id, clip.start, clip.duration]);

describe('packClips', () => {
  it('accole les clips depuis 0', () => {
    expect(packClips([c('a', 1000, 500), c('b', 2000, 9000)]).map((x) => x.start)).toEqual([0, 1000]);
  });
});

describe('normalizeTrack', () => {
  it('trie une piste libre par début sans toucher aux positions', () => {
    const t = normalizeTrack(track('s', 'sticker', [stickerClip('b', { start: 5000 }), stickerClip('a', { start: 1000 })]));
    expect(layout(t)).toEqual([
      ['a', 1000, 3000],
      ['b', 5000, 3000],
    ]);
  });
});

describe('trackEnd / findClipAt', () => {
  const t = main([c('a', 1000), c('b', 2000)]);
  it('calcule la durée de la piste', () => {
    expect(trackEnd(t)).toBe(3000);
    expect(trackEnd(main([]))).toBe(0);
  });
  it('trouve le clip sous le curseur (début inclus, fin exclue)', () => {
    expect(findClipAt(t, 0)?.id).toBe('a');
    expect(findClipAt(t, 999)?.id).toBe('a');
    expect(findClipAt(t, 1000)?.id).toBe('b');
    expect(findClipAt(t, 3000)).toBeUndefined();
  });
});

describe('hasRoom', () => {
  const t = track('o', 'overlay', [c('a', 1000, 1000), c('b', 1000, 4000)]);
  it('accepte un trou suffisant', () => {
    expect(hasRoom(t, 2000, 2000)).toBe(true);
    expect(hasRoom(t, 0, 1000)).toBe(true);
  });
  it('refuse un chevauchement ou un début négatif', () => {
    expect(hasRoom(t, 1500, 1000)).toBe(false);
    expect(hasRoom(t, 2000, 2500)).toBe(false);
    expect(hasRoom(t, -10, 5)).toBe(false);
  });
  it('ignore le clip déplacé', () => {
    expect(hasRoom(t, 1500, 1000, 'a')).toBe(true);
  });
});

describe('appendClips / insertInMainAt', () => {
  it('ajoute à la fin de la piste principale', () => {
    expect(layout(appendClips(main([c('a', 1000)]), [c('b', 500), c('c', 700)]))).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 500],
      ['c', 1500, 700],
    ]);
  });
  it('insère au plus près du temps donné', () => {
    const t = main([c('a', 1000), c('b', 1000), c('c', 1000)]);
    expect(layout(insertInMainAt(t, c('x', 500), 1600)).map((l) => l[0])).toEqual(['a', 'b', 'x', 'c']);
    expect(layout(insertInMainAt(t, c('x', 500), 0)).map((l) => l[0])).toEqual(['x', 'a', 'b', 'c']);
    expect(layout(insertInMainAt(t, c('x', 500), 9000)).map((l) => l[0])).toEqual(['a', 'b', 'c', 'x']);
  });
});

describe('removeClip', () => {
  it('supprime et referme le trou sur la piste principale', () => {
    expect(layout(removeClip(main([c('a', 1000), c('b', 2000), c('c', 500)]), 'b'))).toEqual([
      ['a', 0, 1000],
      ['c', 1000, 500],
    ]);
  });
  it('laisse le trou sur une piste libre', () => {
    const t = track('o', 'overlay', [c('a', 1000, 0), c('b', 1000, 3000)]);
    expect(layout(removeClip(t, 'a'))).toEqual([['b', 3000, 1000]]);
  });
});

describe('splitClipInTrack', () => {
  it('coupe au temps de la timeline', () => {
    const result = splitClipInTrack(main([c('a', 1000), c('b', 4000)]), 'b', 2500, 'b2');
    expect(layout(result!)).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 1500],
      ['b2', 2500, 2500],
    ]);
    expect((result!.clips[2] as MediaClip).inPoint).toBe(1500);
  });
  it('renvoie null si le temps est hors du clip', () => {
    expect(splitClipInTrack(main([c('a', 1000), c('b', 4000)]), 'a', 2500, 'x')).toBeNull();
  });
});

describe('freeBounds / trimClipInTrack', () => {
  it('calcule l’espace libre entre les voisins', () => {
    const t = track('s', 'sticker', [stickerClip('a', { start: 0, duration: 1000 }), stickerClip('b', { start: 2000 }), stickerClip('c', { start: 6000 })]);
    expect(freeBounds(t, 'b')).toEqual({ minStart: 1000, maxEnd: 6000 });
  });
  it('raccourcir la fin décale les clips suivants sur la piste principale', () => {
    const t = trimClipInTrack(main([c('a', 5000), c('b', 2000)]), 'a', 'end', -2000, 10000);
    expect(layout(t)).toEqual([
      ['a', 0, 3000],
      ['b', 3000, 2000],
    ]);
  });
  it('raccourcir le début garde le clip accolé à son voisin', () => {
    const t = trimClipInTrack(main([c('a', 1000), c('b', 5000)]), 'b', 'start', 1500, 10000);
    expect(layout(t)).toEqual([
      ['a', 0, 1000],
      ['b', 1000, 3500],
    ]);
  });
  it('s’arrête contre le voisin sur une piste libre', () => {
    const t = track('s', 'sticker', [stickerClip('a', { start: 0, duration: 1000 }), stickerClip('b', { start: 2000, duration: 1000 }), stickerClip('c', { start: 4000 })]);
    expect(layout(trimClipInTrack(t, 'b', 'start', -5000, null))[1]).toEqual(['b', 1000, 2000]);
    expect(layout(trimClipInTrack(t, 'b', 'end', 5000, null))[1]).toEqual(['b', 2000, 2000]);
  });
});
