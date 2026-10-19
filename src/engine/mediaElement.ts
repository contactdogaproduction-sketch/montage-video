/** Utilitaires pour les éléments `<video>` / `<audio>` hors du DOM, robustes sur iPhone. */

/**
 * Attend un événement d'un média. Échoue sur `error` ou après `timeoutMs`
 * (au lieu d'attendre indéfiniment un événement que le navigateur n'enverra pas).
 */
export function waitForEvent(target: EventTarget, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, onOk);
      target.removeEventListener('error', onError);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('unreadable'));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);
    target.addEventListener(event, onOk);
    target.addEventListener('error', onError);
  });
}

/**
 * Safari sur iPhone ne charge pas les images d'une vidéo tant qu'elle n'a pas été lue.
 * Une lecture muette très brève (autorisée sans geste) force ce chargement.
 * `stillIdle` : rappelé avant la pause, pour ne pas interrompre une vraie lecture lancée entre-temps.
 */
export async function primeVideo(video: HTMLVideoElement, stillIdle: () => boolean = () => true): Promise<void> {
  if (video.readyState >= 2) return;
  const wasMuted = video.muted;
  video.muted = true;
  try {
    await video.play();
    if (stillIdle()) video.pause();
  } catch {
    // Lecture refusée : le chargement se fera à la première lecture.
  } finally {
    video.muted = wasMuted;
  }
}

/** Positionne une vidéo et attend l'image correspondante (échoue après `timeoutMs`). */
export async function seekVideo(video: HTMLVideoElement, seconds: number, timeoutMs: number): Promise<void> {
  const target = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.001));
  if (Math.abs(video.currentTime - target) < 0.0001 && video.readyState >= 2) return;
  const seeked = waitForEvent(video, 'seeked', timeoutMs);
  video.currentTime = target;
  await seeked;
}

/** Prépare une vidéo hors du DOM pour la lecture image par image ou l'aperçu. */
export function createVideoElement(url: string, muted: boolean): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = muted;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.src = url;
  video.load();
  return video;
}

/**
 * Photographie l'image d'une vidéo à `seconds` (taille d'origine), en JPEG.
 * `toDataURL` plutôt que `toBlob`, différé de plusieurs secondes dans certains navigateurs.
 */
export async function captureVideoFrame(url: string, seconds: number): Promise<Blob> {
  const video = createVideoElement(url, true);
  try {
    if (video.readyState < 1) await waitForEvent(video, 'loadedmetadata', 20_000);
    await primeVideo(video);
    await seekVideo(video, seconds, 20_000);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    ctx.drawImage(video, 0, 0);
    return await (await fetch(canvas.toDataURL('image/jpeg', 0.92))).blob();
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
