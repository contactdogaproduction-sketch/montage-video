import { describe, expect, it } from 'vitest';
import { addMedia, createProject, frameCount, getMainTrack, projectDuration, replaceTrack } from './project';
import { fitContain } from './geometry';
import { formatRulerLabel, formatTime, rulerStep } from './time';
import { appendClips } from './track';
import type { MediaInfo } from './types';

const video: MediaInfo = { id: 'v', kind: 'video', name: 'v.mp4', duration: 1050, width: 1920, height: 1080 };

describe('projet', () => {
  it('crée un projet 1080x1920 à 30 i/s avec une piste principale vide', () => {
    const p = createProject('p');
    expect([p.width, p.height, p.fps]).toEqual([1080, 1920, 30]);
    expect(getMainTrack(p).clips).toEqual([]);
    expect(projectDuration(p)).toBe(0);
    expect(frameCount(p)).toBe(0);
  });
  it('calcule la durée et le nombre d’images', () => {
    let p = addMedia(createProject('p'), [video]);
    p = replaceTrack(p, appendClips(getMainTrack(p), [{ id: 'a', mediaId: 'v', start: 0, inPoint: 0, duration: 1050 }]));
    expect(projectDuration(p)).toBe(1050);
    expect(frameCount(p)).toBe(32);
    expect(p.media.v).toBe(video);
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
