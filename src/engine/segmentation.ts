import type { SegmentRequest, SegmentResponse } from './segmentation.worker';

/**
 * Détourage des personnes (arrière-plan supprimé, transition « détourage »), calculé dans un
 * worker sur l'appareil. L'image est réduite à la taille du modèle avant l'envoi ; le masque
 * renvoyé est agrandi au dessin, ce qui adoucit ses bords.
 */
let worker: Worker | null = null;
let loading: Promise<boolean> | null = null;
let onLoaded: ((ok: boolean) => void) | null = null;
let ready = false;
let nextId = 1;
const pending = new Map<number, (mask: ImageData | null) => void>();

function reset(): void {
  worker?.terminate();
  worker = null;
  ready = false;
  loading = null;
  onLoaded?.(false);
  onLoaded = null;
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./segmentation.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<SegmentResponse>) => {
    const message = event.data;
    if (message.type === 'loaded') {
      onLoaded?.(message.ok);
      onLoaded = null;
      return;
    }
    pending.get(message.id)?.(message.mask);
    pending.delete(message.id);
  };
  // Le worker a planté (mémoire insuffisante…) : il sera relancé à la prochaine demande.
  worker.onerror = reset;
  return worker;
}

const send = (request: SegmentRequest, transfer: Transferable[] = []) => getWorker().postMessage(request, transfer);

/** Prépare le détourage (une fois). Renvoie `false` s'il ne peut pas fonctionner sur cet appareil. */
export function loadSegmenter(): Promise<boolean> {
  loading ??= new Promise<boolean>((resolve) => {
    onLoaded = resolve;
    send({ type: 'load' });
  }).then((ok) => {
    ready = ok;
    if (!ok) reset();
    return ok;
  });
  return loading;
}

export function segmenterReady(): boolean {
  return ready;
}

/** Plus grand côté de l'image analysée : la taille du modèle. */
const INPUT_SIZE = 256;
let input: HTMLCanvasElement | null = null;

type Segmentable = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

function isSegmentable(source: CanvasImageSource): source is Segmentable {
  return source instanceof HTMLVideoElement || source instanceof HTMLImageElement || source instanceof HTMLCanvasElement;
}

/** Pixels de l'image réduite à la taille du modèle. */
function reducedPixels(source: Segmentable): ImageData | null {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return null;
  const scale = Math.min(1, INPUT_SIZE / Math.max(width, height));
  input ??= document.createElement('canvas');
  input.width = Math.max(1, Math.round(width * scale));
  input.height = Math.max(1, Math.round(height * scale));
  const ctx = input.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, input.width, input.height);
  return ctx.getImageData(0, 0, input.width, input.height);
}

/** Masque de la personne pour l'image actuelle de `source` (lue tout de suite, calculée ensuite). */
export function requestMask(source: CanvasImageSource): Promise<ImageData | null> {
  if (!ready || !isSegmentable(source)) return Promise.resolve(null);
  const image = reducedPixels(source);
  if (!image) return Promise.resolve(null);
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    send({ type: 'segment', id, image }, [image.data.buffer]);
  });
}

/** Copie un masque dans un canvas (dessinable par le moteur de rendu). */
export function putMask(canvas: HTMLCanvasElement, mask: ImageData): void {
  if (canvas.width !== mask.width || canvas.height !== mask.height) {
    canvas.width = mask.width;
    canvas.height = mask.height;
  }
  canvas.getContext('2d')?.putImageData(mask, 0, 0);
}

interface LiveMask {
  canvas: HTMLCanvasElement;
  /** Image (instant de la vidéo) du dernier calcul demandé. */
  requested: string | null;
  busy: boolean;
  available: boolean;
}

/**
 * Masques de l'aperçu : le dernier masque reçu est utilisé pendant que le suivant se calcule
 * (décalage d'une image au plus pendant la lecture, masque exact à l'arrêt).
 */
export class LiveMasks {
  private readonly entries = new Map<string, LiveMask>();

  constructor(private readonly onUpdate: () => void) {}

  /** `key` : lecteur ou photo ; `frame` : image affichée (instant de la vidéo). */
  get(key: string, frame: string, source: CanvasImageSource): HTMLCanvasElement | null {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { canvas: document.createElement('canvas'), requested: null, busy: false, available: false };
      this.entries.set(key, entry);
    }
    const current = entry;
    if (!current.busy && current.requested !== frame) {
      current.busy = true;
      current.requested = frame;
      void requestMask(source).then((mask) => {
        current.busy = false;
        if (!mask) {
          // Échec : nouvel essai à la prochaine image dessinée.
          current.requested = null;
          return;
        }
        putMask(current.canvas, mask);
        current.available = true;
        this.onUpdate();
      });
    }
    return current.available ? current.canvas : null;
  }

  clear(): void {
    this.entries.clear();
  }
}
