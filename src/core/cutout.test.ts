import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import { addMedia, createProject, getMainTrack, replaceTrack } from './project';
import { VIDEO, mediaClip } from './testUtils';
import { appendClips } from './track';
import { CUTOUT_SWEEP, transitionLayers, usesCutout } from './transition';
import type { MediaClip, Project } from './types';

const project = (clips: MediaClip[]): Project => {
  const p = addMedia(createProject('p'), [VIDEO]);
  return replaceTrack(p, appendClips(getMainTrack(p), clips));
};

describe('détourage', () => {
  it('la personne du premier clip reste devant pendant que le décor défile', () => {
    const layers = transitionLayers('cutout', 0.35);
    expect(layers.map((l) => [l.which, l.effect.cutout])).toEqual([
      ['from', false],
      ['to', false],
      ['from', true],
    ]);
    expect(layers[2]?.effect.offsetX).toBe(0);
    expect(layers[2]?.effect.opacity).toBe(1);
    expect(layers[0]?.effect.offsetX).toBeCloseTo(-0.5);
  });
  it('le décor a fini de défiler, puis la personne s’efface', () => {
    const swept = transitionLayers('cutout', CUTOUT_SWEEP);
    expect(swept.map((l) => l.effect.offsetX)).toEqual([-1, 0, 0]);
    expect(swept[2]?.effect.opacity).toBe(1);
    expect(transitionLayers('cutout', (1 + CUTOUT_SWEEP) / 2)[2]?.effect.opacity).toBeCloseTo(0.5);
    expect(transitionLayers('cutout', 1)[2]?.effect.opacity).toBeCloseTo(0);
  });
  it('sait quand le projet a besoin du détourage', () => {
    expect(usesCutout(project([mediaClip('a'), mediaClip('b')]))).toBe(false);
    expect(usesCutout(project([mediaClip('a', { removeBackground: true })]))).toBe(true);
    expect(usesCutout(project([mediaClip('a', { transition: { type: 'cutout', duration: 500 } }), mediaClip('b')]))).toBe(true);
  });
  it('un clip enregistré avant cette option garde son arrière-plan', () => {
    const raw = { id: 'p', tracks: [{ id: 'main', kind: 'main', clips: [{ type: 'media', id: 'a', mediaId: 'v', start: 0, duration: 1000 }] }] };
    expect((migrateProject(raw, 'p').tracks[0]?.clips[0] as MediaClip).removeBackground).toBe(false);
  });
});
