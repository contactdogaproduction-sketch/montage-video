import { describe, expect, it } from 'vitest';
import { animatedTextTransform } from './animation';
import { CENTERED, splitClip, trimStart } from './clip';
import {
  addKeyframe,
  easeInOut,
  keyframeAt,
  removeKeyframe,
  setKeyframeEasing,
  setTransformAt,
  transformAtTime,
} from './keyframes';
import { mediaClip, stickerClip, textClip } from './testUtils';
import type { Keyframe, Transform } from './types';

const at = (over: Partial<Transform>): Transform => ({ ...CENTERED, ...over });
const kf = (time: number, over: Partial<Transform>, easing: Keyframe['easing'] = 'linear'): Keyframe => ({ time, transform: at(over), easing });

describe('interpolation', () => {
  const clip = stickerClip('s', { start: 1000, duration: 4000, keyframes: [kf(0, { x: 0 }), kf(2000, { x: 1, scale: 2 }, 'ease-in-out'), kf(3000, { x: 0 })] });

  it('sans keyframes, garde le placement fixe', () => {
    expect(transformAtTime(stickerClip('s', { transform: at({ x: 0.3 }) }), 500).x).toBe(0.3);
  });
  it('interpole linéairement', () => {
    expect(transformAtTime(clip, 2000)).toMatchObject({ x: 0.5, scale: 1.5 });
  });
  it('applique la courbe douce sur le segment', () => {
    expect(easeInOut(0.25)).toBeCloseTo(0.125);
    expect(transformAtTime(clip, 3250).x).toBeCloseTo(1 - 0.125);
  });
  it('garde la première et la dernière valeur hors des keyframes', () => {
    expect(transformAtTime(clip, 500).x).toBe(0);
    expect(transformAtTime(clip, 4800).x).toBe(0);
  });
});

describe('édition des keyframes', () => {
  const base = stickerClip('s', { start: 1000, duration: 4000, transform: at({ x: 0.2 }) });

  it('sans keyframes, modifier change le placement fixe', () => {
    const edited = setTransformAt(base, 2000, (t) => ({ ...t, x: 0.7 }));
    expect(edited.transform.x).toBe(0.7);
    expect(edited.keyframes).toEqual([]);
  });
  it('ajoute une keyframe avec le placement courant', () => {
    expect(addKeyframe(base, 1500).keyframes).toEqual([kf(500, { x: 0.2 })]);
  });
  it('avec keyframes, modifier ailleurs crée une keyframe au curseur', () => {
    const animated = addKeyframe(base, 1000);
    const edited = setTransformAt(animated, 3000, (t) => ({ ...t, x: 0.9 }));
    expect(edited.keyframes.map((k) => [k.time, k.transform.x])).toEqual([
      [0, 0.2],
      [2000, 0.9],
    ]);
  });
  it('modifie la keyframe existante au curseur (à une demi-image près)', () => {
    const animated = addKeyframe(base, 3000);
    const edited = setTransformAt(animated, 3010, (t) => ({ ...t, scale: 3 }));
    expect(edited.keyframes).toHaveLength(1);
    expect(edited.keyframes[0]?.transform.scale).toBe(3);
  });
  it('change l’interpolation de la keyframe au curseur', () => {
    const animated = setKeyframeEasing(addKeyframe(base, 1000), 1000, 'ease-in-out');
    expect(keyframeAt(animated, 1000)?.easing).toBe('ease-in-out');
  });
  it('supprimer la dernière keyframe garde le placement à l’écran', () => {
    const animated = setTransformAt(addKeyframe(base, 2000), 2000, (t) => ({ ...t, y: 0.9 }));
    const removed = removeKeyframe(animated, 2000);
    expect(removed.keyframes).toEqual([]);
    expect(removed.transform.y).toBe(0.9);
  });
});

describe('keyframes et découpe', () => {
  it('répartit les keyframes avec une keyframe à la coupe de chaque côté', () => {
    const clip = mediaClip('c', { start: 0, duration: 4000, keyframes: [kf(0, { scale: 1 }), kf(4000, { scale: 3 })] });
    const [left, right] = splitClip(clip, 1000, 'c2')!;
    expect(left.keyframes.map((k) => [k.time, k.transform.scale])).toEqual([
      [0, 1],
      [1000, 1.5],
    ]);
    expect(right.keyframes.map((k) => [k.time, k.transform.scale])).toEqual([
      [0, 1.5],
      [3000, 3],
    ]);
    expect(transformAtTime(right, 2500).scale).toBeCloseTo(transformAtTime(clip, 2500).scale);
  });
  it('le trim du début garde les keyframes au même endroit de la timeline', () => {
    const clip = mediaClip('c', { start: 0, duration: 4000, keyframes: [kf(2000, { x: 0.8 })] });
    const trimmed = trimStart(clip, 500, 10000);
    expect(trimmed.keyframes[0]?.time).toBe(1500);
    expect(trimmed.start + (trimmed.keyframes[0]?.time ?? 0)).toBe(2000);
  });
});

describe('texte animé', () => {
  it('combine keyframes et animation d’entrée', () => {
    const clip = textClip('t', { start: 0, duration: 3000, animationIn: 'zoom', keyframes: [kf(0, { scale: 2 }), kf(3000, { scale: 2 })] });
    expect(animatedTextTransform(clip, 0).scale).toBe(1);
    expect(animatedTextTransform(clip, 1500).scale).toBe(2);
  });
});
