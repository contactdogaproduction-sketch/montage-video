import { describe, expect, it } from 'vitest';
import { CENTERED } from './clip';
import { fitContain } from './geometry';
import {
  addMedia,
  canHost,
  createProject,
  duplicateClipInProject,
  findClipLocation,
  frameCount,
  getMainTrack,
  moveClip,
  placeClip,
  projectDuration,
  removeClipFromProject,
  replaceTrack,
  splitClipInProject,
  trimClipInProject,
} from './project';
import { AUDIO, IMAGE, VIDEO, mediaClip, stickerClip, textClip, track } from './testUtils';
import { formatRulerLabel, formatTime, rulerStep } from './time';
import { appendClips } from './track';
import type { Project } from './types';

const base = (): Project => addMedia(createProject('p'), [VIDEO, IMAGE, AUDIO]);
const layout = (p: Project) => p.tracks.map((t) => `${t.id}:${t.kind}[${t.clips.map((c) => `${c.id}@${c.start}`).join(',')}]`);

describe('projet', () => {
  it('crée un projet 1080x1920 à 30 i/s avec une piste principale vide', () => {
    const p = createProject('p');
    expect([p.width, p.height, p.fps]).toEqual([1080, 1920, 30]);
    expect(getMainTrack(p).clips).toEqual([]);
    expect(projectDuration(p)).toBe(0);
    expect(frameCount(p)).toBe(0);
  });
  it('prend la durée de la piste la plus longue', () => {
    let p = replaceTrack(base(), appendClips(getMainTrack(base()), [mediaClip('a', { duration: 1050 })]));
    expect(frameCount(p)).toBe(32);
    p = placeClip(p, textClip('t', { start: 2000, duration: 3000 }), 'tt');
    expect(projectDuration(p)).toBe(5000);
  });
});

describe('placeClip', () => {
  it('crée une piste du bon type puis la réutilise s’il y a la place', () => {
    let p = placeClip(base(), textClip('t1', { start: 0 }), 'T1');
    p = placeClip(p, textClip('t2', { start: 5000 }), 'T2');
    expect(layout(p)).toEqual(['main:main[]', 'T1:text[t1@0,t2@5000]']);
  });
  it('ouvre une nouvelle piste en cas de chevauchement', () => {
    let p = placeClip(base(), stickerClip('s1', { start: 0 }), 'S1');
    p = placeClip(p, stickerClip('s2', { start: 1000 }), 'S2');
    expect(layout(p)).toEqual(['main:main[]', 'S1:sticker[s1@0]', 'S2:sticker[s2@1000]']);
  });
  it('range l’audio sur une piste audio et les médias visuels en incrustation', () => {
    let p = placeClip(base(), mediaClip('a', { mediaId: 'a' }), 'A');
    p = placeClip(p, mediaClip('o', { mediaId: 'i' }), 'O');
    expect(p.tracks.map((t) => t.kind)).toEqual(['main', 'audio', 'overlay']);
  });
});

describe('canHost', () => {
  const p = base();
  it('accepte vidéos et photos sur la principale et les incrustations uniquement', () => {
    expect(canHost(p, track('m', 'main'), mediaClip('x'))).toBe(true);
    expect(canHost(p, track('o', 'overlay'), mediaClip('x', { mediaId: 'i' }))).toBe(true);
    expect(canHost(p, track('a', 'audio'), mediaClip('x'))).toBe(false);
    expect(canHost(p, track('m', 'main'), mediaClip('x', { mediaId: 'a' }))).toBe(false);
    expect(canHost(p, track('t', 'text'), stickerClip('s'))).toBe(false);
  });
});

describe('opérations sur toutes les pistes', () => {
  const withSticker = () => placeClip(base(), stickerClip('s', { start: 1000, duration: 2000 }), 'S');
  it('coupe un clip d’une piste libre', () => {
    const p = splitClipInProject(withSticker(), 's', 2000, 's2')!;
    expect(layout(p)).toEqual(['main:main[]', 'S:sticker[s@1000,s2@2000]']);
  });
  it('duplique à la suite s’il y a la place, sinon sur une nouvelle piste', () => {
    let p = duplicateClipInProject(withSticker(), 's', 'copy', 'N')!;
    expect(layout(p)).toEqual(['main:main[]', 'S:sticker[s@1000,copy@3000]']);
    p = duplicateClipInProject(p, 's', 'copy2', 'N2')!;
    expect(layout(p)).toEqual(['main:main[]', 'S:sticker[s@1000,copy@3000]', 'N2:sticker[copy2@3000]']);
  });
  it('supprime la piste libre devenue vide', () => {
    expect(layout(removeClipFromProject(withSticker(), 's'))).toEqual(['main:main[]']);
  });
  it('trim d’un clip vidéo limité par sa source', () => {
    let p = replaceTrack(base(), appendClips(getMainTrack(base()), [mediaClip('a', { duration: 9000 })]));
    p = trimClipInProject(p, 'a', 'end', 5000);
    expect(findClipLocation(p, 'a')?.clip.duration).toBe(10000);
  });
});

describe('moveClip', () => {
  const twoMain = () =>
    replaceTrack(base(), appendClips(getMainTrack(base()), [mediaClip('a', { duration: 2000 }), mediaClip('b', { duration: 2000 })]));

  it('réordonne la piste principale', () => {
    const p = moveClip(twoMain(), 'a', { trackId: 'main' }, 2500, 'x')!;
    expect(layout(p)).toEqual(['main:main[b@0,a@2000]']);
  });
  it('déplace un clip principal en incrustation (nouvelle piste) et referme le trou', () => {
    const p = moveClip(twoMain(), 'a', { newTrackId: 'O' }, 1000, 'x')!;
    expect(layout(p)).toEqual(['main:main[b@0]', 'O:overlay[a@1000]']);
  });
  it('recentre une incrustation qui rejoint la piste principale', () => {
    let p = placeClip(twoMain(), mediaClip('o', { mediaId: 'i', start: 0, transform: { ...CENTERED, scale: 0.5, x: 0.2 } }), 'O');
    p = moveClip(p, 'o', { trackId: 'main' }, 4000, 'x')!;
    expect(layout(p)).toEqual(['main:main[a@0,b@2000,o@4000]']);
    expect(findClipLocation(p, 'o')?.clip).toMatchObject({ transform: CENTERED });
  });
  it('déplace sur une piste libre, ou crée une piste au-dessus si la place est prise', () => {
    let p = placeClip(base(), stickerClip('s1', { start: 0, duration: 1000 }), 'S');
    p = placeClip(p, stickerClip('s2', { start: 2000, duration: 1000 }), 'S');
    expect(layout(moveClip(p, 's2', { trackId: 'S' }, 1200, 'N')!)).toEqual(['main:main[]', 'S:sticker[s1@0,s2@1200]']);
    expect(layout(moveClip(p, 's2', { trackId: 'S' }, 500, 'N')!)).toEqual(['main:main[]', 'S:sticker[s1@0]', 'N:sticker[s2@500]']);
  });
  it('refuse une piste incompatible', () => {
    const p = placeClip(base(), stickerClip('s', { start: 0 }), 'S');
    expect(moveClip(p, 's', { trackId: 'main' }, 0, 'x')).toBeNull();
  });
});

describe('fitContain', () => {
  it('centre une vidéo paysage dans un cadre vertical', () => {
    expect(fitContain(1920, 1080, 1080, 1920)).toEqual({ x: 0, y: 656.25, width: 1080, height: 607.5 });
  });
  it('remplit le cadre pour une source au même ratio', () => {
    expect(fitContain(720, 1280, 1080, 1920)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
  });
});

describe('formatage du temps', () => {
  it('formate mm:ss.d', () => {
    expect(formatTime(0)).toBe('00:00.0');
    expect(formatTime(65432)).toBe('01:05.4');
  });
  it('formate les graduations', () => {
    expect(formatRulerLabel(5000)).toBe('0:05');
    expect(formatRulerLabel(90000)).toBe('1:30');
    expect(formatRulerLabel(2500)).toBe('0:02.5');
  });
  it('choisit un pas de graduation lisible', () => {
    expect(rulerStep(100)).toBe(1000);
    expect(rulerStep(600)).toBe(100);
    expect(rulerStep(10)).toBe(10000);
  });
});
