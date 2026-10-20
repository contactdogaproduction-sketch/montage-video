/**
 * Rattrapage des lecteurs de l'aperçu : une vidéo en avance ou en retard sur l'horloge de lecture
 * est ralentie ou accélérée légèrement (invisible), plutôt que repositionnée (image et son coupés).
 * Écarts en secondes du temps de la source, positifs quand le lecteur est en avance.
 */

/** Écart à partir duquel le rattrapage commence. */
export const CATCH_UP_START_S = 0.08;
/** Écart sous lequel le rattrapage s'arrête (plus petit que le seuil de départ : pas d'oscillation). */
export const CATCH_UP_STOP_S = 0.02;
/** Écart de vitesse pendant le rattrapage (8 %). */
export const CATCH_UP_RATE = 0.08;
/** Au-delà de cet écart, le lecteur est repositionné (rattrapage trop long). */
export const SEEK_DRIFT_S = 1;

export interface SyncDecision {
  /** Vitesse de lecture à appliquer au lecteur. */
  rate: number;
  /** Rattrapage en cours (à transmettre à l'appel suivant). */
  catchingUp: boolean;
  /** Repositionnement nécessaire. */
  seek: boolean;
}

export function syncDecision(drift: number, speed: number, catchingUp: boolean): SyncDecision {
  const size = Math.abs(drift) / speed;
  if (size >= SEEK_DRIFT_S) return { rate: speed, catchingUp: false, seek: true };
  if (size > (catchingUp ? CATCH_UP_STOP_S : CATCH_UP_START_S)) {
    return { rate: speed * (drift > 0 ? 1 - CATCH_UP_RATE : 1 + CATCH_UP_RATE), catchingUp: true, seek: false };
  }
  return { rate: speed, catchingUp: false, seek: false };
}
