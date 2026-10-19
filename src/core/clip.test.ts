import { describe, expect, it } from 'vitest';
import {
  IMAGE_DEFAULT_DURATION,
  MIN_CLIP_DURATION,
  canSplitAt,
  clipEnd,
  clipMediaId,
  createMediaClip,
  sourceTimeAt,
  splitClip,
  trimEnd,
  trimStart,
} from './clip';
import { IMAGE, VIDEO, mediaClip, stickerClip, textClip } from './testUtils';
import type { MediaClip, TextClip } from './types';

const clip = (over: Partial<MediaClip> = {}) => mediaClip('c1', { duration: 10000, ...over });

describe('createMediaClip', () => {
  it('prend la durée de la vidéo, volume 100 %, sans fondu', () => {
    expect(createMediaClip('a', VIDEO, 500)).toMatchObject({ id: 'a', mediaId: 'v', start: 500, inPoint: 0, duration: 10000, volume: 1, fadeIn: 0, fadeOut: 0 });
  });
  it('donne une durée par défaut aux images', () => {
    expect(createMediaClip('a', IMAGE, 0).duration).toBe(IMAGE_DEFAULT_DURATION);
  });
});

describe('clipMediaId', () => {
  it('renvoie le média d’un clip média ou d’un sticker PNG', () => {
    expect(clipMediaId(clip())).toBe('v');
    expect(clipMediaId(stickerClip('s', { source: { kind: 'image', mediaId: 'p' } }))).toBe('p');
    expect(clipMediaId(stickerClip('s'))).toBeNull();
    expect(clipMediaId(textClip('t'))).toBeNull();
  });
});

describe('sourceTimeAt', () => {
  it('tient compte du point d’entrée et de la position', () => {
    expect(sourceTimeAt(clip({ start: 2000, inPoint: 1000 }), 2500)).toBe(1500);
  });
});

describe('splitClip', () => {
  it('coupe un clip média en deux parties contiguës dans la source', () => {
    const [left, right] = splitClip(clip({ start: 1000, inPoint: 500, duration: 4000 }), 3000, 'c2') as [MediaClip, MediaClip];
    expect(left).toMatchObject({ id: 'c1', start: 1000, inPoint: 500, duration: 2000 });
    expect(right).toMatchObject({ id: 'c2', start: 3000, inPoint: 2500, duration: 2000 });
    expect(clipEnd(left)).toBe(right.start);
  });
  it('garde le fondu d’entrée à gauche et celui de sortie à droite', () => {
    const [left, right] = splitClip(clip({ fadeIn: 500, fadeOut: 700 }), 5000, 'c2') as [MediaClip, MediaClip];
    expect([left.fadeIn, left.fadeOut, right.fadeIn, right.fadeOut]).toEqual([500, 0, 0, 700]);
  });
  it('répartit les animations d’un texte', () => {
    const t = textClip('t', { duration: 4000, animationIn: 'zoom', animationOut: 'fade' });
    const [left, right] = splitClip(t, 2000, 't2') as [TextClip, TextClip];
    expect([left.animationIn, left.animationOut, right.animationIn, right.animationOut]).toEqual(['zoom', 'none', 'none', 'fade']);
    expect(right.text).toBe(t.text);
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
    expect(trimStart(clip({ start: 1000 }), 2000, 10000)).toMatchObject({ start: 3000, inPoint: 2000, duration: 8000 });
  });
  it('ne recule pas avant le début de la source', () => {
    const c = clip({ start: 5000, inPoint: 1000, duration: 3000 });
    expect(trimStart(c, -4000, 10000)).toMatchObject({ start: 4000, inPoint: 0, duration: 4000 });
  });
  it('respecte le début minimal (voisin précédent)', () => {
    const c = clip({ start: 5000, inPoint: 3000, duration: 3000 });
    expect(trimStart(c, -4000, 10000, 4500)).toMatchObject({ start: 4500, inPoint: 2500, duration: 3500 });
  });
  it('garde la durée minimale', () => {
    expect(trimStart(clip(), 50000, 10000).duration).toBe(MIN_CLIP_DURATION);
  });
  it('allonge une image ou un texte sans point d’entrée', () => {
    const c = clip({ mediaId: 'i', start: 3000, duration: 3000 });
    expect(trimStart(c, -1000, null)).toMatchObject({ start: 2000, inPoint: 0, duration: 4000 });
    expect(trimStart(textClip('t', { start: 3000 }), -1000, null)).toMatchObject({ start: 2000, duration: 4000 });
  });
});

describe('trimEnd', () => {
  it('raccourcit la fin', () => {
    expect(trimEnd(clip(), -3000, 10000).duration).toBe(7000);
  });
  it('ne dépasse pas la fin de la source', () => {
    expect(trimEnd(clip({ inPoint: 2000, duration: 5000 }), 9000, 10000).duration).toBe(8000);
  });
  it('ne dépasse pas la fin maximale (voisin suivant)', () => {
    expect(trimEnd(stickerClip('s', { start: 1000, duration: 1000 }), 5000, null, 2500).duration).toBe(1500);
  });
  it('garde la durée minimale', () => {
    expect(trimEnd(clip(), -20000, 10000).duration).toBe(MIN_CLIP_DURATION);
  });
  it('allonge librement une image', () => {
    expect(trimEnd(clip({ mediaId: 'i', duration: 3000 }), 60000, null).duration).toBe(63000);
  });
});
