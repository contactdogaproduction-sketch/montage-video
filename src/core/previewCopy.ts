/**
 * Copie allégée d'une vidéo, utilisée seulement par l'aperçu : une vidéo de téléphone (1080p ou 4K,
 * souvent en HEVC et à 60 images/s) est trop lourde à décoder à plusieurs en même temps sur un
 * téléphone. L'export utilise toujours le fichier d'origine.
 */

/** Plus grand côté de la copie, en pixels (720p). */
export const PREVIEW_COPY_LONG_SIDE = 1280;
/** Cadence de la copie : celle du projet. */
export const PREVIEW_COPY_FPS = 30;
/** Une image complète toutes les demi-secondes : repositionnement rapide (coupes, déplacement du curseur). */
export const PREVIEW_COPY_KEYFRAME_INTERVAL_S = 0.5;
/** Au-delà de cette cadence, une vidéo est allégée même si elle est petite. */
const MAX_FPS = 31;

export interface VideoSize {
  width: number;
  height: number;
}

const even = (n: number) => Math.max(2, 2 * Math.round(n / 2));

/**
 * Taille de la copie allégée d'une vidéo (dimensions affichées), ou `null` si la vidéo est déjà
 * assez légère pour l'aperçu. Les dimensions sont paires (exigence des encodeurs H.264).
 */
export function previewCopySize(width: number, height: number, fps: number): VideoSize | null {
  const long = Math.max(width, height);
  if (long <= 0) return null;
  if (long <= PREVIEW_COPY_LONG_SIDE && fps <= MAX_FPS) return null;
  const scale = Math.min(1, PREVIEW_COPY_LONG_SIDE / long);
  return { width: even(width * scale), height: even(height * scale) };
}
