import type { MediaInfo } from '../../core/types';

const THUMBNAIL_HEIGHT = 96;

export interface ReadMediaResult {
  info: MediaInfo;
  url: string;
  thumbnail: string | null;
}

function waitFor(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('unreadable'));
    };
    const cleanup = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(event, onOk);
    target.addEventListener('error', onError);
  });
}

function makeThumbnail(source: CanvasImageSource, width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return null;
  const canvas = document.createElement('canvas');
  canvas.height = THUMBNAIL_HEIGHT;
  canvas.width = Math.max(1, Math.round((width / height) * THUMBNAIL_HEIGHT));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

async function readVideo(file: File, id: string, url: string): Promise<ReadMediaResult> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await waitFor(video, 'loadedmetadata');
  if (video.duration === Infinity) {
    // Certains WebM n'indiquent pas leur durée : un saut en fin de fichier force son calcul.
    video.currentTime = Number.MAX_SAFE_INTEGER;
    await waitFor(video, 'seeked');
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth === 0) {
    throw new Error('unreadable');
  }
  video.currentTime = Math.min(0.1, video.duration / 2);
  await waitFor(video, 'seeked');
  const info: MediaInfo = {
    id,
    kind: 'video',
    name: file.name,
    duration: Math.round(video.duration * 1000),
    width: video.videoWidth,
    height: video.videoHeight,
  };
  const thumbnail = makeThumbnail(video, video.videoWidth, video.videoHeight);
  video.removeAttribute('src');
  video.load();
  return { info, url, thumbnail };
}

async function readImage(file: File, id: string, url: string): Promise<ReadMediaResult> {
  const img = new Image();
  img.src = url;
  await waitFor(img, 'load');
  const info: MediaInfo = {
    id,
    kind: 'image',
    name: file.name,
    duration: null,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
  return { info, url, thumbnail: makeThumbnail(img, img.naturalWidth, img.naturalHeight) };
}

/** Lit les métadonnées d'un fichier et prépare sa miniature. Lève une erreur si le navigateur ne sait pas le lire. */
export async function readMedia(file: File, id: string): Promise<ReadMediaResult> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith('video/')) return await readVideo(file, id, url);
    if (file.type.startsWith('image/')) return await readImage(file, id, url);
    throw new Error('unsupported');
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
