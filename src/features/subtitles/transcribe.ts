import { create } from 'zustand';
import type { TranscriptChunk } from '../../core/subtitles';
import type { Project } from '../../core/types';
import { mixProjectAudio } from '../../engine/export/audioMix';
import { MODEL_CHOICES, type ModelChoice, type TranscriptLanguage, type WorkerRequest, type WorkerResponse } from './protocol';

const WHISPER_SAMPLE_RATE = 16000;

/** Vrai si le projet contient au moins un clip vidéo ou audio (du son à transcrire). */
export function projectHasSound(project: Project): boolean {
  return project.tracks.some((t) =>
    t.clips.some((c) => c.type === 'media' && project.media[c.mediaId]?.kind !== 'image' && c.volume > 0 && t.volume > 0),
  );
}

/** Son de tout le projet (volumes, fondus et vitesses compris), en mono 16 kHz, aligné sur la timeline. */
export async function projectAudio16k(project: Project, signal: AbortSignal): Promise<Float32Array> {
  const mix = await mixProjectAudio(project, signal);
  const length = Math.max(1, Math.ceil(mix.duration * WHISPER_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(1, length, WHISPER_SAMPLE_RATE);
  const source = ctx.createBufferSource();
  source.buffer = mix;
  source.connect(ctx.destination);
  source.start();
  const rendered = await ctx.startRendering();
  signal.throwIfAborted();
  // Copie indépendante : elle est transférée au worker sans toucher au tampon audio du navigateur.
  return rendered.getChannelData(0).slice();
}

/** État du modèle de reconnaissance, partagé par l'interface. */
interface ModelState {
  /** Modèle chargé ou en cours de chargement. */
  model: ModelChoice | null;
  status: 'idle' | 'loading' | 'ready';
  /** Avancement du téléchargement (0 à 1) au premier usage, `null` s'il n'y a rien à télécharger. */
  download: number | null;
}

export const useModelStore = create<ModelState>()(() => ({ model: null, status: 'idle', download: null }));

let worker: Worker | null = null;
const listeners = new Set<(message: WorkerResponse) => void>();

/**
 * Le worker reste ouvert entre deux transcriptions : le modèle n'est chargé qu'une fois par session
 * (le téléchargement, lui, n'a lieu qu'une fois par appareil).
 */
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === 'download') useModelStore.setState({ download: message.progress });
    if (message.type === 'loaded' && message.model === useModelStore.getState().model) useModelStore.setState({ status: 'ready', download: null });
    if (message.type === 'error' && useModelStore.getState().status === 'loading') useModelStore.setState({ status: 'idle', download: null });
    for (const listener of listeners) listener(message);
  };
  worker.onerror = (event) => {
    const message: WorkerResponse = { type: 'error', message: event.message || 'Le module de transcription n’a pas pu démarrer.' };
    for (const listener of listeners) listener(message);
    stopWorker();
  };
  return worker;
}

function stopWorker(): void {
  worker?.terminate();
  worker = null;
  useModelStore.setState({ model: null, status: 'idle', download: null });
}

function send(request: WorkerRequest, transfer: Transferable[] = []): void {
  getWorker().postMessage(request, transfer);
}

/** Commence à charger le modèle en arrière-plan (ouverture de la fenêtre, changement de qualité). */
export function prepareTranscriber(model: ModelChoice): void {
  const state = useModelStore.getState();
  if (state.model === model && state.status !== 'idle') return;
  useModelStore.setState({ model, status: 'loading', download: null });
  send({ type: 'load', model });
}

export type TranscriptionStage = 'audio' | 'model' | 'transcribe';

/** Transcrit le son du projet. L'annulation arrête le worker (le modèle sera rechargé au prochain usage). */
export async function transcribeProject(
  project: Project,
  language: TranscriptLanguage,
  model: ModelChoice,
  signal: AbortSignal,
  onStage: (stage: TranscriptionStage) => void,
): Promise<TranscriptChunk[]> {
  onStage('audio');
  const audio = await projectAudio16k(project, signal);
  prepareTranscriber(model);
  onStage(useModelStore.getState().status === 'ready' ? 'transcribe' : 'model');

  let listener: ((message: WorkerResponse) => void) | null = null;
  try {
    return await new Promise<TranscriptChunk[]>((resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          stopWorker();
          reject(signal.reason);
        },
        { once: true },
      );
      listener = (message) => {
        if (message.type === 'loaded') onStage('transcribe');
        else if (message.type === 'result') resolve(message.chunks);
        else if (message.type === 'error') reject(new Error(message.message));
      };
      listeners.add(listener);
      send({ type: 'transcribe', model, audio, language }, [audio.buffer]);
    });
  } finally {
    if (listener) listeners.delete(listener);
  }
}

/**
 * Le modèle (et le moteur de calcul) sont-ils déjà sur l'appareil ? Ils sont alors utilisables
 * sans connexion. Cache tenu par transformers.js (« transformers-cache »).
 */
export async function isModelDownloaded(model: ModelChoice): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const urls = (await (await caches.open('transformers-cache')).keys()).map((r) => r.url);
    const { repo, files } = MODEL_CHOICES[model];
    const hasRuntime = urls.some((u) => /ort-wasm-simd-threaded[^/]*\.wasm$/.test(u));
    return hasRuntime && files.every((file) => urls.some((u) => u.includes(repo) && u.endsWith(file)));
  } catch {
    return false;
  }
}
