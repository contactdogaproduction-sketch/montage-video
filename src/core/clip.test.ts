import { describe, expect, it } from 'vitest';
import {
  IMAGE_DEFAULT_DURATION,
  MIN_CLIP_DURATION,
  canSplitAt,
  clipEnd,
  createClip,
  sourceTimeAt,
  splitClip,
  trimEnd,
  trimStart,
} from './clip';
import type { Clip, MediaInfo } from './types';

const video: MediaInfo = { id: 'v', kind: 'video', name: 'v.mp4', duration: 10000, width: 1920, height: 1080 };
const image: MediaInfo = { id: 'i', kind: 'image', name: 'i.png', duration: null, width: 800, height: 800 };

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c1',
  mediaId: 'v',
  start: 0,
  inPoint: 0,
  duration: 10000,
  ...over,
});

describe('createClip', () => {
  it('prend la durée de la vidéo', () => {
    expect(createClip('a', video, 500)).toEqual({ id: 'a', mediaId: 'v', start: 500, inPoint: 0, duration: 10000 });
  });
  it('donne une durée par défaut aux images', () => {
    expect(createClip('a', image, 0).duration).toBe(IMAGE_DEFAULT_DURATION);
  });
});

describe('sourceTimeAt', () => {
  it('tient compte du point d’entrée et de la position', () => {
    expect(sourceTimeAt(clip({ start: 2000, inPoint: 1000 }), 2500)).toBe(1500);
  });
});

describe('splitClip', () => {
  it('coupe en deux parties contiguës dans la source', () => {
    const result = splitClip(clip({ start: 1000, inPoint: 500, duration: 4000 }), 3000, 'c2');
    expect(result).not.toBeNull();
    const [left, right] = result!;
    expect(left).toEqual({ id: 'c1', mediaId: 'v', start: 1000, inPoint: 500, duration: 2000 });
    expect(right).toEqual({ id: 'c2', mediaId: 'v', start: 3000, inPoint: 2500, duration: 2000 });
    expect(clipEnd(left)).toBe(right.start);
  });
  it('refuse de couper sur les bords ou hors du clip', () => {
    const c = clip({ start: 1000, duration: 4000 });
    expect(splitClip(c, 1000, 'x')).toBeNull();
    expect(splitClip(c, 5000, 'x')).toBeNull();
    expect(splitClip(c, 200, 'x')).toBeNull();
    expect(splitClip(c, 9000, 'x')).toBeNull();
  });
  it('refuse une partie plus courte que la durée minimale', () => {
    const c = clip({ duration: 4000 });
    expect(canSplitAt(c, MIN_CLIP_DURATION - 1)).toBe(false);
    expect(canSplitAt(c, MIN_CLIP_DURATION)).toBe(true);
    expect(canSplitAt(c, 4000 - MIN_CLIP_DURATION + 1)).toBe(false);
  });
  it('arrondit le point de coupe à la milliseconde', () => {
    const [left] = splitClip(clip(), 1234.6, 'x')!;
    expect(left.duration).toBe(1235);
  });
});

describe('trimStart', () => {
  it('raccourcit le début en avançant le point d’entrée', () => {
    expect(trimStart(clip({ start: 1000 }), 2000, video)).toEqual(
      clip({ start: 3000, inPoint: 2000, duration: 8000 }),
    );
  });
  it('ne recule pas avant le début de la source', () => {
    const c = clip({ start: 5000, inPoint: 1000, duration: 3000 });
    expect(trimStart(c, -4000, video)).toEqual(clip({ start: 4000, inPoint: 0, duration: 4000 }));
  });
  it('garde la durée minimale', () => {
    expect(trimStart(clip(), 50000, video).duration).toBe(MIN_CLIP_DURATION);
  });
  it('allonge une image sans toucher au point d’entrée', () => {
    const c = clip({ mediaId: 'i', start: 3000, duration: 3000 });
    expect(trimStart(c, -1000, image)).toEqual({ ...c, start: 2000, duration: 4000 });
  });
});

describe('trimEnd', () => {
  it('raccourcit la fin', () => {
    expect(trimEnd(clip(), -3000, video).duration).toBe(7000);
  });
  it('ne dépasse pas la fin de la source', () => {
    expect(trimEnd(clip({ inPoint: 2000, duration: 5000 }), 9000, video).duration).toBe(8000);
  });
  it('garde la durée minimale', () => {
    expect(trimEnd(clip(), -20000, video).duration).toBe(MIN_CLIP_DURATION);
  });
  it('allonge librement une image', () => {
    expect(trimEnd(clip({ mediaId: 'i', duration: 3000 }), 60000, image).duration).toBe(63000);
  });
});
