import type { Clip, Easing, Keyframe, Ms, Transform } from './types';

/** Deux keyframes à moins d'une demi-image (30 i/s) sont considérées au même instant. */
export const KEYFRAME_TOLERANCE: Ms = 17;

export function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

export function lerpTransform(a: Transform, b: Transform, p: number): Transform {
  return {
    x: lerp(a.x, b.x, p),
    y: lerp(a.y, b.y, p),
    scale: lerp(a.scale, b.scale, p),
    rotation: lerp(a.rotation, b.rotation, p),
    opacity: lerp(a.opacity, b.opacity, p),
  };
}

/** Placement interpolé à l'instant `local` (relatif au début du clip). */
export function interpolateKeyframes(keyframes: Keyframe[], fallback: Transform, local: Ms): Transform {
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (!first || !last) return fallback;
  if (local <= first.time) return first.transform;
  if (local >= last.time) return last.transform;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i] as Keyframe;
    const b = keyframes[i + 1] as Keyframe;
    if (local >= a.time && local <= b.time) {
      const raw = b.time === a.time ? 1 : (local - a.time) / (b.time - a.time);
      return lerpTransform(a.transform, b.transform, a.easing === 'ease-in-out' ? easeInOut(raw) : raw);
    }
  }
  return last.transform;
}

/** Placement de l'élément au temps `t` de la timeline (keyframes comprises). */
export function transformAtTime(clip: Clip, t: Ms): Transform {
  return interpolateKeyframes(clip.keyframes, clip.transform, t - clip.start);
}

export function keyframeIndexAt(clip: Clip, t: Ms): number {
  const local = t - clip.start;
  return clip.keyframes.findIndex((k) => Math.abs(k.time - local) <= KEYFRAME_TOLERANCE);
}

export function keyframeAt(clip: Clip, t: Ms): Keyframe | undefined {
  return clip.keyframes[keyframeIndexAt(clip, t)];
}

function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

/** Interpolation reprise par une nouvelle keyframe : celle de la keyframe qui la précède. */
function inheritedEasing(clip: Clip, local: Ms): Easing {
  const previous = [...clip.keyframes].reverse().find((k) => k.time < local);
  return previous?.easing ?? 'linear';
}

/**
 * Modifie le placement au temps `t`. Sans keyframes : modifie le placement fixe.
 * Avec keyframes : met à jour celle du curseur, ou en crée une (comportement de CapCut).
 */
export function setTransformAt(clip: Clip, t: Ms, update: (transform: Transform) => Transform): Clip {
  if (clip.keyframes.length === 0) return { ...clip, transform: update(clip.transform) };
  const index = keyframeIndexAt(clip, t);
  if (index >= 0) {
    const keyframes = clip.keyframes.map((k, i) => (i === index ? { ...k, transform: update(k.transform) } : k));
    return { ...clip, keyframes };
  }
  const local = Math.round(t - clip.start);
  const keyframe: Keyframe = { time: local, transform: update(transformAtTime(clip, t)), easing: inheritedEasing(clip, local) };
  return { ...clip, keyframes: sortKeyframes([...clip.keyframes, keyframe]) };
}

/** Ajoute une keyframe au temps `t` avec le placement actuel (sans effet s'il y en a déjà une). */
export function addKeyframe(clip: Clip, t: Ms): Clip {
  if (keyframeIndexAt(clip, t) >= 0) return clip;
  const local = Math.round(t - clip.start);
  const keyframe: Keyframe = { time: local, transform: transformAtTime(clip, t), easing: inheritedEasing(clip, local) };
  return { ...clip, keyframes: sortKeyframes([...clip.keyframes, keyframe]) };
}

/** Supprime la keyframe au temps `t`. La dernière supprimée devient le placement fixe (rien ne saute). */
export function removeKeyframe(clip: Clip, t: Ms): Clip {
  const index = keyframeIndexAt(clip, t);
  const removed = clip.keyframes[index];
  if (!removed) return clip;
  const keyframes = clip.keyframes.filter((_, i) => i !== index);
  return keyframes.length === 0 ? { ...clip, keyframes, transform: removed.transform } : { ...clip, keyframes };
}

export function setKeyframeEasing(clip: Clip, t: Ms, easing: Easing): Clip {
  const index = keyframeIndexAt(clip, t);
  if (index < 0) return clip;
  return { ...clip, keyframes: clip.keyframes.map((k, i) => (i === index ? { ...k, easing } : k)) };
}

/**
 * Répartit les keyframes de part et d'autre d'une coupe à l'instant `local`.
 * Une keyframe est ajoutée de chaque côté à la coupe pour que le mouvement reste continu.
 */
export function splitKeyframes(keyframes: Keyframe[], fallback: Transform, local: Ms): [Keyframe[], Keyframe[]] {
  if (keyframes.length === 0) return [[], []];
  const atCut = interpolateKeyframes(keyframes, fallback, local);
  const easing = [...keyframes].reverse().find((k) => k.time < local)?.easing ?? 'linear';
  const left = keyframes.filter((k) => k.time < local);
  const right = keyframes.filter((k) => k.time > local).map((k) => ({ ...k, time: k.time - local }));
  return [
    [...left, { time: local, transform: atCut, easing }],
    [{ time: 0, transform: atCut, easing }, ...right],
  ];
}

/** Décale les keyframes (après un trim du début) pour qu'elles restent au même endroit de la timeline. */
export function shiftKeyframes(keyframes: Keyframe[], delta: Ms): Keyframe[] {
  return delta === 0 ? keyframes : keyframes.map((k) => ({ ...k, time: k.time + delta }));
}
