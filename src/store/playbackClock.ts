import type { Ms } from '../core/types';

/**
 * Temps de lecture diffusé à chaque image pendant la lecture, hors de React : les éléments qui
 * bougent en continu (curseur de la timeline, compteur) se mettent à jour directement, sans
 * recalculer toute l'interface 60 fois par seconde. Le store ne reçoit le temps qu'à l'arrêt.
 */
type Listener = (t: Ms) => void;

const listeners = new Set<Listener>();

export function emitPlaybackTime(t: Ms): void {
  for (const listener of listeners) listener(t);
}

export function onPlaybackTime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let lastTime: Ms = 0;
onPlaybackTime((t) => {
  lastTime = t;
});

/** Dernier temps de lecture diffusé (pendant la lecture, plus récent que celui du store). */
export function currentPlaybackTime(): Ms {
  return lastTime;
}
