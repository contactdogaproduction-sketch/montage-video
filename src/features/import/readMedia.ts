import type { MediaInfo, MediaKind } from '../../core/types';
import { createVideoElement, primeVideo, seekVideo, waitForEvent } from '../../engine/mediaElement';

const THUMBNAIL_HEIGHT = 96;
/** Délai maximal pour lire les informations d'un fichier (grosses vidéos sur téléphone). */
const METADATA_TIMEOUT_MS = 20_000;
/** Délai maximal pour obtenir l'image de la miniature ; au-delà, le clip est importé sans miniature. */
const THUMBNAIL_TIMEOUT_MS = 5_000;

export interface ReadMediaResult {
  info: MediaInfo;
  url: string;
  thumbnail: string | null;
}

const waitFor = (target: EventTarget, event: string) => waitForEvent(target, event, METADATA_TIMEOUT_MS);

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
  const video = createVideoElement(url, true);
  const metadata = waitFor(video, 'loadedmetadata');
  if (video.readyState < 1) await metadata;
  else void metadata.catch(() => undefined);
  if (video.duration === Infinity) {
    // Certains WebM n'indiquent pas leur durée : un saut en fin de fichier force son calcul.
    const seeked = waitFor(video, 'seeked');
    video.currentTime = Number.MAX_SAFE_INTEGER;
    await seeked;
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth === 0) {
    throw new Error('unreadable');
  }
  const info: MediaInfo = {
    id,
    kind: 'video',
    name: file.name,
    duration: Math.round(video.duration * 1000),
    width: video.videoWidth,
    height: video.videoHeight,
  };
  // Miniature : facultative. Sur iPhone, une lecture muette brève est nécessaire pour obtenir une image.
  let thumbnail: string | null = null;
  try {
    await primeVideo(video);
    await seekVideo(video, Math.min(0.1, video.duration / 2), THUMBNAIL_TIMEOUT_MS);
    thumbnail = makeThumbnail(video, video.videoWidth, video.videoHeight);
  } catch {
    thumbnail = null;
  }
  video.pause();
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

async function readAudio(file: File, id: string, url: string): Promise<ReadMediaResult> {
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  const metadata = waitFor(audio, 'loadedmetadata');
  audio.src = url;
  audio.load();
  await metadata;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('unreadable');
  const info: MediaInfo = {
    id,
    kind: 'audio',
    name: file.name,
    duration: Math.round(audio.duration * 1000),
    width: 0,
    height: 0,
  };
  audio.removeAttribute('src');
  audio.load();
  return { info, url, thumbnail: null };
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', '3gp'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'caf', 'aif', 'aiff'];

const extensionsOf = (list: string[]) => list.map((ext) => `.${ext}`).join(',');

/**
 * Filtres des sélecteurs de fichiers. Les extensions explicites aident iOS et Android à proposer
 * tous les fichiers compatibles (un simple « audio/* » en masque une partie).
 */
export const ACCEPT_VISUAL = `video/*,image/*,${extensionsOf(VIDEO_EXTENSIONS)},${extensionsOf(IMAGE_EXTENSIONS)}`;
export const ACCEPT_AUDIO = `audio/*,${extensionsOf(AUDIO_EXTENSIONS)}`;
export const ACCEPT_ALL = `${ACCEPT_VISUAL},${ACCEPT_AUDIO}`;

const hasExtension = (file: File, list: string[]) => list.includes(file.name.split('.').pop()?.toLowerCase() ?? '');

/** Type de média d'un fichier (certains systèmes ne renseignent pas le type MIME). */
export function fileMediaKind(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (hasExtension(file, VIDEO_EXTENSIONS)) return 'video';
  if (hasExtension(file, IMAGE_EXTENSIONS)) return 'image';
  if (hasExtension(file, AUDIO_EXTENSIONS)) return 'audio';
  return null;
}

/** Lit les métadonnées d'un fichier et prépare sa miniature. Lève une erreur si le navigateur ne sait pas le lire. */
export async function readMedia(file: File, id: string): Promise<ReadMediaResult> {
  const url = URL.createObjectURL(file);
  try {
    const kind = fileMediaKind(file);
    if (kind === 'video') return await readVideo(file, id, url);
    if (kind === 'image') return await readImage(file, id, url);
    if (kind === 'audio') return await readAudio(file, id, url);
    throw new Error('unsupported');
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
