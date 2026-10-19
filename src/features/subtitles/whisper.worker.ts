/**
 * Transcription locale avec Whisper (transformers.js), dans un worker pour ne pas figer l'interface.
 * Le modèle est téléchargé depuis Hugging Face au premier usage puis gardé en cache sur l'appareil ;
 * le moteur de calcul (ONNX Runtime) est servi par l'application elle-même.
 */
import { env, pipeline } from '@huggingface/transformers';
import runtimeMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import runtimeWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import type { ModelChoice, WorkerRequest, WorkerResponse } from './protocol';

/**
 * Modèles proposés, calculés sur le processeur (WebAssembly, tous navigateurs, iPhone compris) :
 * - Rapide : whisper-base, encodeur non compressé (la compression 8 bits de l'encodeur dégradait
 *   fortement la reconnaissance du français) + décodeur 8 bits : 136 Mo ;
 * - Précis : whisper-small 8 bits : 250 Mo, bien plus fiable en français, 3 à 4 fois plus lent.
 * Les variantes pour carte graphique pèsent plus de 200 Mo pour le seul modèle de base.
 */
const MODELS: Record<ModelChoice, { id: string; dtype: string | Record<string, string> }> = {
  fast: { id: 'onnx-community/whisper-base', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
  accurate: { id: 'onnx-community/whisper-small', dtype: 'q8' },
};

const post = (message: WorkerResponse) => (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(message);

interface ProgressInfo {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;

async function loadTranscriber(model: ModelChoice): Promise<Transcriber> {
  const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
  if (onnx.wasm) onnx.wasm.wasmPaths = { mjs: runtimeMjs, wasm: runtimeWasm };

  // Progression du téléchargement, tous fichiers du modèle confondus.
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (info: ProgressInfo) => {
    if (info.status !== 'progress' || !info.file || !info.total) return;
    files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    post({ type: 'download', progress: total > 0 ? loaded / total : 0 });
  };

  const { id, dtype } = MODELS[model];
  return pipeline('automatic-speech-recognition', id, { device: 'wasm', dtype, progress_callback } as Record<string, unknown>) as unknown as Promise<Transcriber>;
}

/** Un seul modèle gardé en mémoire (celui choisi) pour les transcriptions suivantes. */
let current: { model: ModelChoice; loading: Promise<Transcriber> } | null = null;

function ensureLoaded(model: ModelChoice): Promise<Transcriber> {
  if (!current || current.model !== model) {
    const previous = current?.loading;
    // Changement de modèle : l'ancien est libéré (mémoire limitée sur téléphone).
    void previous?.then((t) => (t as unknown as { dispose?: () => Promise<void> }).dispose?.()).catch(() => undefined);
    const loading = loadTranscriber(model);
    current = { model, loading };
    loading.then(
      () => post({ type: 'loaded', model }),
      () => {
        if (current?.loading === loading) current = null;
      },
    );
  }
  return current.loading;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const transcriber = await ensureLoaded(request.model);
    if (request.type === 'load') return;
    const { audio, language } = request;
    const duration = audio.length / 16000;
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: 'transcribe',
      ...(language ? { language } : {}),
    });
    const chunks = (output.chunks ?? [{ text: output.text, timestamp: [0, duration] as [number, number] }]).map((c) => ({
      text: c.text,
      start: Math.round(c.timestamp[0] * 1000),
      end: Math.round((c.timestamp[1] ?? duration) * 1000),
    }));
    post({ type: 'result', chunks });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
