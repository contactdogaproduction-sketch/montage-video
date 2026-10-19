import { describe, expect, it } from 'vitest';
import { setClipSpeed, sourceTimeAt, splitClip, trimEnd, trimStart } from './clip';
import { fitContain, fitCover } from './geometry';
import { migrateProject } from './migrate';
import { addMedia, changeClipSpeed, createProject, findClipLocation, getMainTrack, placeClip, replaceTrack, setProjectFormat } from './project';
import { AUDIO, VIDEO, mediaClip } from './testUtils';
import { appendClips } from './track';
import type { MediaClip } from './types';

describe('vitesse', () => {
  const fast = mediaClip('c', { start: 1000, inPoint: 2000, duration: 2000, speed: 2 });

  it('lit la source plus vite', () => {
    expect(sourceTimeAt(fast, 1000)).toBe(2000);
    expect(sourceTimeAt(fast, 2000)).toBe(4000);
    expect(sourceTimeAt(mediaClip('s', { speed: 0.5 }), 1000)).toBe(500);
  });
  it('garde le passage de la source et adapte la durée', () => {
    const c = mediaClip('c', { duration: 4000, keyframes: [{ time: 2000, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, easing: 'linear' }] });
    const doubled = setClipSpeed(c, 2) as MediaClip;
    expect([doubled.speed, doubled.duration, doubled.keyframes[0]?.time]).toEqual([2, 2000, 1000]);
    const slow = setClipSpeed(c, 0.5) as MediaClip;
    expect(slow.duration).toBe(8000);
    expect(sourceTimeAt(slow, 8000)).toBe(4000);
  });
  it('limite le trim à la source en tenant compte de la vitesse', () => {
    // Source 10 s, à 2x : depuis 2 s il reste 8 s de source = 4 s de timeline.
    expect(trimEnd(fast, 10000, 10000).duration).toBe(4000);
    // Reculer le début de 1,5 s de timeline = 3 s de source, limité à 2 s de source = 1 s de timeline.
    expect(trimStart(fast, -1500, 10000)).toMatchObject({ start: 0, inPoint: 0, duration: 3000 });
    expect(trimStart(fast, 500, 10000)).toMatchObject({ start: 1500, inPoint: 3000, duration: 1500 });
  });
  it('coupe au bon endroit de la source', () => {
    const [, right] = splitClip(fast, 1500, 'r') as [MediaClip, MediaClip];
    expect(right).toMatchObject({ start: 1500, inPoint: 3000, duration: 1500, speed: 2 });
  });
  it('décale la suite de la piste principale', () => {
    let p = addMedia(createProject('p'), [VIDEO]);
    p = replaceTrack(p, appendClips(getMainTrack(p), [mediaClip('a', { duration: 4000 }), mediaClip('b', { duration: 1000 })]));
    p = changeClipSpeed(p, 'a', 2, 'x');
    expect(getMainTrack(p).clips.map((c) => [c.start, c.duration])).toEqual([
      [0, 2000],
      [2000, 1000],
    ]);
  });
  it('déplace un clip audio ralenti qui déborderait sur son voisin', () => {
    let p = addMedia(createProject('p'), [AUDIO]);
    p = placeClip(p, mediaClip('a1', { mediaId: 'a', start: 0, duration: 2000 }), 'A');
    p = placeClip(p, mediaClip('a2', { mediaId: 'a', start: 3000, duration: 2000 }), 'A');
    p = changeClipSpeed(p, 'a1', 0.5, 'B');
    expect(findClipLocation(p, 'a1')?.track.id).toBe('B');
    expect(findClipLocation(p, 'a1')?.clip.duration).toBe(4000);
    expect(findClipLocation(p, 'a2')?.track.id).toBe('A');
  });
});

describe('formats et cadrage', () => {
  it('change les dimensions selon le format', () => {
    expect(setProjectFormat(createProject('p'), '16:9')).toMatchObject({ format: '16:9', width: 1920, height: 1080 });
    expect(setProjectFormat(createProject('p'), '1:1')).toMatchObject({ width: 1080, height: 1080 });
  });
  it('remplit le cadre en rognant (Remplir) ou garde toute l’image (Ajuster)', () => {
    const cover = fitCover(1920, 1080, 1080, 1920);
    expect(cover.width).toBeCloseTo(3413.33, 1);
    expect([cover.height, cover.y]).toEqual([1920, 0]);
    expect(cover.x).toBeCloseTo(-1166.67, 1);
    expect(fitContain(1920, 1080, 1080, 1080)).toMatchObject({ width: 1080, height: 607.5 });
  });
  it('les projets enregistrés avant gardent le vertical et reçoivent vitesse 1 et Ajuster', () => {
    const p = migrateProject({ id: 'p', width: 1080, height: 1920, tracks: [{ id: 'main', kind: 'main', clips: [{ type: 'media', id: 'c', mediaId: 'v', start: 0, duration: 100 }] }] }, 'f');
    expect([p.format, p.width, p.height]).toEqual(['9:16', 1080, 1920]);
    expect(p.tracks[0]?.clips[0]).toMatchObject({ speed: 1, fit: 'contain' });
    expect(migrateProject({ id: 'p', format: '1:1', width: 1, height: 1 }, 'f')).toMatchObject({ width: 1080, height: 1080 });
  });
});
