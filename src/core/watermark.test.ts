import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import { addMedia, createProject, getMainTrack, replaceTrack, setProjectFormat } from './project';
import { VIDEO, mediaClip } from './testUtils';
import { appendClips } from './track';
import type { Project } from './types';
import { watermarkRect } from './watermark';

const withClip = (p: Project): Project => replaceTrack(addMedia(p, [VIDEO]), appendClips(getMainTrack(p), [mediaClip('a')]));

describe('filigrane', () => {
  it('est en haut à gauche par défaut, y compris pour un projet enregistré avant le filigrane', () => {
    expect(createProject('p').watermark).toBe('top-left');
    expect(migrateProject({ id: 'p', tracks: [] }, 'p').watermark).toBe('top-left');
  });
  it('garde un projet sans filigrane', () => {
    expect(migrateProject({ id: 'p', tracks: [], watermark: null }, 'p').watermark).toBeNull();
    expect(watermarkRect({ ...createProject('p'), watermark: null }, 1)).toBeNull();
  });
  it('n’apparaît pas tant que le projet est vide', () => {
    expect(watermarkRect(createProject('p'), 1)).toBeNull();
  });
  it('place le logo dans le coin choisi, à la même taille quel que soit le format', () => {
    const vertical = withClip(createProject('p'));
    expect(watermarkRect(vertical, 1)).toEqual({ x: 54, y: 54, width: 151.20000000000002, height: 151.20000000000002 });
    const corner = watermarkRect({ ...vertical, watermark: 'bottom-right' }, 2);
    expect(corner?.x).toBeCloseTo(1080 - 54 - 151.2);
    expect(corner?.y).toBeCloseTo(1920 - 54 - 75.6);
    const wide = watermarkRect({ ...setProjectFormat(vertical, '16:9'), watermark: 'top-right' }, 1);
    expect(wide?.width).toBeCloseTo(151.2);
    expect(wide?.x).toBeCloseTo(1920 - 54 - 151.2);
  });
});
