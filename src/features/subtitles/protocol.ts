import type { TranscriptChunk } from '../../core/subtitles';

/** Langue parlée : code Whisper, ou `null` pour la détection automatique. */
export type TranscriptLanguage = 'fr' | 'en' | null;

/** Modèle de reconnaissance : « Rapide » (whisper-base) ou « Précis » (whisper-small). */
export type ModelChoice = 'fast' | 'accurate';

export interface ModelDefinition {
  label: string;
  sizeMb: number;
  /** Dépôt Hugging Face. */
  repo: string;
  /** Variantes des fichiers (transformers.js). */
  dtype: string | Record<string, string>;
  /** Fichiers les plus lourds, pour savoir si le modèle est déjà sur l'appareil. */
  files: string[];
}

/**
 * Modèles proposés, calculés sur le processeur (WebAssembly, tous navigateurs, iPhone compris) :
 * - Rapide : whisper-base, encodeur non compressé (la compression 8 bits de l'encodeur dégradait
 *   fortement la reconnaissance du français) + décodeur 8 bits : 136 Mo ;
 * - Précis : whisper-small 8 bits : 250 Mo, bien plus fiable en français, 3 à 4 fois plus lent.
 */
export const MODEL_CHOICES: Record<ModelChoice, ModelDefinition> = {
  fast: {
    label: 'Rapide',
    sizeMb: 136,
    repo: 'onnx-community/whisper-base',
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
    files: ['onnx/encoder_model.onnx', 'onnx/decoder_model_merged_quantized.onnx'],
  },
  accurate: {
    label: 'Précis',
    sizeMb: 250,
    repo: 'onnx-community/whisper-small',
    dtype: 'q8',
    files: ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'],
  },
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
