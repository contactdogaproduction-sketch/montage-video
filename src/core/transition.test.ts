import { describe, expect, it } from 'vitest';
import { trackFades } from './audio';
import { splitClip } from './clip';
import { activeMediaClips, visibleLayers } from './composition';
import { addMedia, createProject, getMainTrack, moveClip, placeClip, projectDuration, removeClipFromProject, replaceTrack, updateClip } from './project';
import { AUDIO, VIDEO, mediaClip, track } from './testUtils';
import { appendClips, packClips } from './track';
import { maxTransitionDuration, transitionAt, transitionLayers, transitionOverlap } from './transition';
import type { MediaClip, Project, Transition } from './types';

const fade = (duration: number): Transition => ({ type: 'fade', duration });
const twoClips = (transition: Transition | null): Project => {
  const p = addMedia(createProject('p'), [VIDEO, { ...VIDEO, id: 'w' }, AUDIO]);
  const clips = [mediaClip('a', { duration: 3000, transition }), mediaClip('b', { mediaId: 'w', duration: 2000 })];
  return replaceTrack(p, appendClips(getMainTrack(p), clips));
};
const starts = (p: Project) => getMainTrack(p).clips.map((c) => c.start);

describe('chevauchement', () => {
  it('le clip suivant commence plus tôt de la durée de la transition', () => {
    const p = twoClips(fade(500));
    expect(starts(p)).toEqual([0, 2500]);
    expect(projectDuration(p)).toBe(4500);
  });
  it('limite la durée à la moitié du clip le plus court et à 2 s', () => {
    const a = mediaClip('a', { duration: 3000, transition: fade(5000) });
    const b = mediaClip('b', { duration: 1000 });
    expect(maxTransitionDuration(a, b)).toBe(500);
    expect(transitionOverlap(a, b)).toBe(500);
    expect(maxTransitionDuration(mediaClip('x', { duration: 9000 }), mediaClip('y', { duration: 9000 }))).toBe(2000);
  });
  it('n’a pas d’effet sur le dernier clip', () => {
    expect(packClips([mediaClip('a', { duration: 1000, transition: fade(500) })]).map((c) => c.start)).toEqual([0]);
  });
  it('disparaît avec le clip supprimé et se recalcule au changement de durée', () => {
    let p = twoClips(fade(500));
    p = removeClipFromProject(p, 'a');
    expect(starts(p)).toEqual([0]);
    p = updateClip(twoClips(fade(500)), 'a', (c) => ({ ...c, transition: fade(800) }));
    expect(starts(p)).toEqual([0, 2200]);
  });
  it('est retirée quand le clip quitte la piste principale', () => {
    const p = moveClip(twoClips(fade(500)), 'a', { newTrackId: 'O' }, 0, 'x')!;
    expect((p.tracks.find((t) => t.id === 'O')?.clips[0] as MediaClip).transition).toBeNull();
  });
  it('reste à la fin du clip coupé', () => {
    const [left, right] = splitClip(mediaClip('a', { duration: 3000, transition: fade(500) }), 1000, 'a2') as [MediaClip, MediaClip];
    expect([left.transition, right.transition]).toEqual([null, fade(500)]);
  });
});

describe('déroulé', () => {
  const p = twoClips(fade(1000));
  const main = getMainTrack(p);
  it('détecte la transition et son avancement', () => {
    expect(transitionAt(main, 1999)).toBeNull();
    expect(transitionAt(main, 2500)?.progress).toBeCloseTo(0.5);
    expect(transitionAt(main, 3000)).toBeNull();
  });
  it('dessine les deux clips pendant la transition', () => {
    expect(visibleLayers(p, 2500).map((l) => [l.clip.id, l.effect?.opacity])).toEqual([
      ['a', 1],
      ['b', 0.5],
    ]);
    expect(visibleLayers(p, 1000).map((l) => l.clip.id)).toEqual(['a']);
  });
  it('utilise un second lecteur quand les deux clips viennent de la même vidéo', () => {
    const same = updateClip(p, 'b', (c) => ({ ...c, mediaId: 'v' }));
    expect(visibleLayers(same, 2500).map((l) => l.slot)).toEqual([0, 1]);
    expect(visibleLayers(p, 2500).map((l) => l.slot)).toEqual([0, 0]);
  });
  it('croise le son des deux clips', () => {
    const gains = activeMediaClips(p, 2500).map((a) => [a.clip.id, a.gain]);
    expect(gains).toEqual([
      ['a', 0.5],
      ['b', 0.5],
    ]);
    expect(trackFades(getMainTrack(p), getMainTrack(p).clips[0] as MediaClip)).toEqual({ fadeIn: 0, fadeOut: 1000 });
  });
  it('ignore les photos et inclut les pistes audio', () => {
    const withAudio = placeClip(p, mediaClip('m', { mediaId: 'a', start: 0, duration: 5000 }), 'A');
    expect(activeMediaClips(withAudio, 100).map((a) => a.clip.id)).toEqual(['a', 'm']);
    expect(track('x', 'audio').kind).toBe('audio');
  });
});

describe('effets des transitions', () => {
  it('fondu au noir : le premier s’éteint puis le second s’allume', () => {
    const [from, to] = transitionLayers('fade-black', 0.25);
    expect([from?.effect.opacity, to?.effect.opacity]).toEqual([0.5, 0]);
    const [, toLate] = transitionLayers('fade-black', 0.75);
    expect(toLate?.effect.opacity).toBe(0.5);
  });
  it('glissement : le second pousse le premier', () => {
    const [from, to] = transitionLayers('slide', 0.5);
    expect(from?.effect.offsetX).toBeCloseTo(-0.5);
    expect(to?.effect.offsetX).toBeCloseTo(0.5);
    expect(transitionLayers('slide', 1)[1]?.effect.offsetX).toBe(0);
  });
  it('zoom et flou : le premier est dessiné par-dessus et s’efface', () => {
    const zoom = transitionLayers('zoom', 1);
    expect(zoom.map((l) => l.which)).toEqual(['to', 'from']);
    expect(zoom[1]?.effect).toMatchObject({ scale: 1.5, opacity: 0 });
    const blur = transitionLayers('blur', 0.5);
    expect(blur[1]?.effect).toMatchObject({ blur: 1, opacity: 0.5 });
    expect(blur[0]?.effect.blur).toBe(0);
  });
});
