/// <reference lib="webworker" />
import { ImageSegmenter } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_module_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url';
import modelAssetPath from '../assets/models/selfie_segmenter.tflite?url';

/**
 * Détourage des personnes hors de la page (MediaPipe, modèle « selfie segmenter » de 250 Ko) :
 * l'aperçu reste fluide pendant le calcul. Processeur seulement : identique partout.
 */
export type SegmentRequest = { type: 'load' } | { type: 'segment'; id: number; image: ImageData };

export type SegmentResponse =
  | { type: 'loaded'; ok: boolean }
  /** Masque : opaque sur la personne, transparent ailleurs (canal alpha), à la taille de l'image reçue. */
  | { type: 'mask'; id: number; mask: ImageData | null };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let segmenter: ImageSegmenter | null = null;

/** Bords du masque adoucis entre ces deux niveaux de confiance. */
const EDGE_LOW = 0.3;
const EDGE_HIGH = 0.7;

function segment(image: ImageData): ImageData | null {
  if (!segmenter) return null;
  const result = segmenter.segment(image);
  const masks = result.confidenceMasks ?? [];
  try {
    // Le modèle donne la confiance « personne » dans son dernier masque.
    const mask = masks[masks.length - 1];
    if (!mask) return null;
    const values = mask.getAsFloat32Array();
    const out = new ImageData(mask.width, mask.height);
    for (let i = 0; i < values.length; i++) {
      const p = Math.min(1, Math.max(0, ((values[i] ?? 0) - EDGE_LOW) / (EDGE_HIGH - EDGE_LOW)));
      out.data[i * 4 + 3] = Math.round(p * p * (3 - 2 * p) * 255);
    }
    return out;
  } finally {
    for (const m of masks) m.close();
  }
}

scope.onmessage = async (event: MessageEvent<SegmentRequest>) => {
  const message = event.data;
  if (message.type === 'load') {
    try {
      segmenter ??= await ImageSegmenter.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        {
          baseOptions: { modelAssetPath, delegate: 'CPU' },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        },
      );
      scope.postMessage({ type: 'loaded', ok: true } satisfies SegmentResponse);
    } catch {
      scope.postMessage({ type: 'loaded', ok: false } satisfies SegmentResponse);
    }
    return;
  }
  let mask: ImageData | null = null;
  try {
    mask = segment(message.image);
  } catch {
    mask = null;
  }
  scope.postMessage({ type: 'mask', id: message.id, mask } satisfies SegmentResponse, mask ? [mask.data.buffer] : []);
};
