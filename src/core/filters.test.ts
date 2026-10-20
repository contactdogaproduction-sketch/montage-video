import { describe, expect, it } from 'vitest';
import { createMediaClip, splitClip } from './clip';
import { FILTER_TYPES, filterOperations, makeFilter } from './filters';
import { migrateProject } from './migrate';
import { VIDEO } from './testUtils';
import { transitionLayers } from './transition';
import type { MediaClip } from './types';

describe('filtres', () => {
  it('aucune opération sans filtre ou à intensité nulle', () => {
    expect(filterOperations(null)).toEqual([]);
    expect(filterOperations({ type: 'bw', intensity: 0 })).toEqual([]);
  });
  it('chaque filtre a des opérations, proportionnelles à l’intensité', () => {
    for (const type of FILTER_TYPES) {
      const full = filterOperations({ type, intensity: 1 });
      const half = filterOperations({ type, intensity: 0.5 });
      expect(full.length).toBeGreaterThan(0);
      expect(half.map((op) => op.alpha)).toEqual(full.map((op) => op.alpha / 2));
    }
  });
  it('limite l’intensité entre 0 et 1', () => {
    expect(makeFilter('pop', 3)).toEqual({ type: 'pop', intensity: 1 });
    expect(makeFilter('pop', -1)).toEqual({ type: 'pop', intensity: 0 });
    expect(makeFilter(null)).toBeNull();
  });
  it('un clip coupé garde son filtre des deux côtés', () => {
    const clip: MediaClip = { ...createMediaClip('a', VIDEO, 0), filter: { type: 'sepia', intensity: 0.6 } };
    const parts = splitClip(clip, 500, 'b');
    expect(parts?.map((p) => (p as MediaClip).filter)).toEqual([clip.filter, clip.filter]);
  });
  it('un clip enregistré avant les filtres n’en a pas', () => {
    const raw = { id: 'p', tracks: [{ id: 'main', kind: 'main', clips: [{ type: 'media', id: 'a', mediaId: 'v', start: 0, duration: 1000 }] }] };
    const clip = migrateProject(raw, 'p').tracks[0]?.clips[0] as MediaClip;
    expect(clip.filter).toBeNull();
  });
});

describe('transitions à la mode', () => {
  it('flash blanc : le blanc culmine au milieu, où l’on change de clip', () => {
    expect(transitionLayers('flash', 0.25).map((l) => l.which)).toEqual(['from']);
    expect(transitionLayers('flash', 0.75).map((l) => l.which)).toEqual(['to']);
    expect(transitionLayers('flash', 0.5)[0]?.effect.flash).toBeCloseTo(1);
    expect(transitionLayers('flash', 0)[0]?.effect.flash).toBeCloseTo(0);
    expect(transitionLayers('flash', 0.25)[0]?.effect.flash).toBeCloseTo(0.5);
  });
  it('balayage flou : les images filent vers la gauche, flou maximal au milieu', () => {
    const start = transitionLayers('whip', 0);
    const middle = transitionLayers('whip', 0.5);
    const end = transitionLayers('whip', 1);
    expect(start.map((l) => l.effect.offsetX)).toEqual([-0, 1]);
    expect(middle.map((l) => l.effect.offsetX)).toEqual([-0.5, 0.5]);
    expect(end.map((l) => l.effect.offsetX)).toEqual([-1, 0]);
    expect(middle[0]?.effect.motionBlur).toBeCloseTo(0.35);
    expect(start[0]?.effect.motionBlur).toBeCloseTo(0);
    // Mouvement lent au début, très rapide au milieu.
    expect(-(transitionLayers('whip', 0.1)[0]?.effect.offsetX ?? 0)).toBeLessThan(0.01);
  });
});
