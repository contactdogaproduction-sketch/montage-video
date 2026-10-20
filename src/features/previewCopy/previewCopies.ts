import { create } from 'zustand';
import { getMediaSource, onMediaPreview, onMediaRegistered, setMediaPreview } from '../../store/mediaRegistry';
import { notify } from '../../ui/notify';
import type { CopyRequest, CopyResponse } from './protocol';

/**
 * Copies allégées des vidéos pour l'aperçu : créées une par une en arrière-plan après l'import
 * (ou à l'ouverture d'un projet qui n'en a pas encore), puis enregistrées avec le projet.
 * En attendant, l'aperçu utilise le fichier d'origine.
 */
interface PreviewCopyState {
  /** Vidéos en attente, en comptant celle en cours. */
  remaining: number;
  /** Avancement de la vidéo en cours (0 à 1). */
  progress: number;
}

export const usePreviewCopyStore = create<PreviewCopyState>()(() => ({ remaining: 0, progress: 0 }));

const queue: CopyRequest[] = [];
let worker: Worker | null = null;
let running: CopyRequest | null = null;
let unsupported = false;

function refresh(progress = 0): void {
  usePreviewCopyStore.setState({ remaining: queue.length + (running ? 1 : 0), progress });
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./previewCopy.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<CopyResponse>) => {
    const message = event.data;
    const job = running;
    if (!job || message.id !== job.id) return;
    if (message.type === 'progress') {
      refresh(message.progress);
      return;
    }
    if (message.type === 'done') setMediaPreview(job.id, job.file, new Blob([message.data], { type: 'video/mp4' }));
    if (message.type === 'unsupported') {
      unsupported = true;
      queue.length = 0;
      notify('Ce navigateur ne sait pas alléger les vidéos pour l’aperçu : mettez à jour votre téléphone (iOS 16.4 ou plus récent) pour une lecture plus fluide.');
    }
    running = null;
    next();
  };
  // Le worker a planté (mémoire insuffisante…) : on passe à la vidéo suivante avec un worker neuf.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    running = null;
    next();
  };
  return worker;
}

function next(): void {
  if (running) return;
  // Vidéos d'un projet refermé entre-temps : ignorées.
  let job = queue.shift();
  while (job && getMediaSource(job.id)?.file !== job.file) job = queue.shift();
  if (!job) {
    refresh();
    // Plus rien à convertir : le worker est libéré (mémoire du téléphone).
    worker?.terminate();
    worker = null;
    return;
  }
  running = job;
  refresh();
  getWorker().postMessage(job);
}

function isVisualVideoCandidate(file: Blob): boolean {
  // Images et sons : jamais de copie (le worker le vérifierait aussi, mais inutile de lire le fichier).
  return !file.type.startsWith('image/') && !file.type.startsWith('audio/');
}

/** Lance la création des copies pour chaque vidéo ajoutée ou rouverte. À appeler au démarrage. */
export function startPreviewCopies(): void {
  onMediaRegistered((id, source) => {
    if (unsupported || source.preview || !isVisualVideoCandidate(source.file)) return;
    queue.push({ id, file: source.file });
    next();
  });
  // Copies supprimées (après l'export) : les conversions en attente ou en cours sont abandonnées.
  onMediaPreview((id, preview) => {
    if (preview) return;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]?.id === id) queue.splice(i, 1);
    if (running?.id === id) {
      worker?.terminate();
      worker = null;
      running = null;
    }
    next();
  });
}
