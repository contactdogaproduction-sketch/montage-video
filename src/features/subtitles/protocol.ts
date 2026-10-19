import type { TranscriptChunk } from '../../core/subtitles';

/** Langue parlée : code Whisper, ou `null` pour la détection automatique. */
export type TranscriptLanguage = 'fr' | 'en' | null;

/** Modèle de reconnaissance : « Rapide » (whisper-base) ou « Précis » (whisper-small). */
export type ModelChoice = 'fast' | 'accurate';

export const MODEL_CHOICES: Record<ModelChoice, { label: string; sizeMb: number }> = {
  fast: { label: 'Rapide', sizeMb: 136 },
  accurate: { label: 'Précis', sizeMb: 250 },
};

export type WorkerRequest =
  /** Charge le modèle à l'avance (téléchargement au premier usage). */
  | { type: 'load'; model: ModelChoice }
  /** Son mono à 16 kHz. */
  | { type: 'transcribe'; model: ModelChoice; audio: Float32Array; language: TranscriptLanguage };

export type WorkerResponse =
  | { type: 'download'; progress: number }
  | { type: 'loaded'; model: ModelChoice }
  | { type: 'result'; chunks: TranscriptChunk[] }
  | { type: 'error'; message: string };
