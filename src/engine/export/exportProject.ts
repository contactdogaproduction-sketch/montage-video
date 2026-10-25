import { FFmpeg } from '@ffmpeg/ffmpeg';
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { frameCount } from '../../core/project';
import type { Project } from '../../core/types';
import { usesCutout } from '../../core/transition';
import { loadFonts } from '../fonts';
import { loadSegmenter } from '../segmentation';
import { mixProjectAudio } from './audioMix';
import { FrameSource } from './FrameSource';
import { encodeWav } from './wav';

export type ExportStage = 'prepare' | 'audio' | 'video' | 'finalize';

export interface ExportProgress {
  /** Avancement global entre 0 et 1. */
  ratio: number;
  stage: ExportStage;
}

export interface ExportOptions {
  onProgress: (progress: ExportProgress) => void;
  signal: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  /** Médias dont le son n'a pas pu être lu (la vidéo exportée est muette pour eux). */
  silentMedia: string[];
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export annulé.');
  }
}

/** Images par segment : borne la mémoire utilisée (fichiers JPEG en mémoire de FFmpeg). */
const SEGMENT_FRAMES = 90;
const JPEG_QUALITY = 0.92;

/** Débit de la vidéo encodée par l'appareil (1080p, 30 images/s). */
const VIDEO_BITRATE = 12_000_000;
const AUDIO_BITRATE = 192_000;
/** Une image complète toutes les 2 s. */
const KEYFRAME_INTERVAL_S = 2;

/** Au-delà, le chargement de l'encodeur est considéré comme bloqué (worker non chargé). */
const LOAD_TIMEOUT_MS = 90_000;

/** Charge FFmpeg ; échoue clairement au lieu d'attendre indéfiniment si le worker ne démarre pas. */
async function loadEncoder(ffmpeg: FFmpeg): Promise<void> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('Impossible de charger l’encodeur vidéo.')), LOAD_TIMEOUT_MS);
  });
  try {
    await Promise.race([ffmpeg.load({ coreURL, wasmURL }), timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

const frameName =(segment: number, index: number) => `s${segment}_${String(index).padStart(4, '0')}.jpg`;

/**
 * Encode le canvas en JPEG. `toDataURL` (synchrone) est utilisé plutôt que `toBlob` :
 * l'encodage asynchrone est différé par certains navigateurs (jusqu'à 1 à 3 s par image mesurées).
 */
function canvasToJpeg(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let stretchCount = 0;

/**
 * Accélère ou ralentit un extrait sonore avec le filtre `atempo` de FFmpeg, qui garde la hauteur
 * de la voix (la vitesse de lecture du navigateur la changerait : effet « voix de canard »).
 */
async function stretchAudio(ffmpeg: FFmpeg, segment: AudioBuffer, speed: number): Promise<AudioBuffer> {
  const id = stretchCount++;
  const input = `tempo_in_${id}.wav`;
  const output = `tempo_out_${id}.wav`;
  await ffmpeg.writeFile(input, encodeWav(segment));
  await run(ffmpeg, ['-i', input, '-filter:a', `atempo=${speed}`, output]);
  const data = await ffmpeg.readFile(output);
  await ffmpeg.deleteFile(input);
  await ffmpeg.deleteFile(output);
  if (typeof data === 'string') throw new Error('Son accéléré illisible.');
  const decoder = new OfflineAudioContext(segment.numberOfChannels, 1, segment.sampleRate);
  return decoder.decodeAudioData(data.slice().buffer);
}

async function run(ffmpeg: FFmpeg, args: string[]): Promise<void> {
  const code = await ffmpeg.exec(args);
  if (code !== 0) throw new Error(`L’encodage a échoué (code ${code}).`);
}

async function encodeSegment(ffmpeg: FFmpeg, segment: number, count: number, fps: number): Promise<string> {
  const output = `seg${segment}.mp4`;
  await run(ffmpeg, [
    '-framerate', String(fps),
    '-start_number', '0',
    '-i', `s${segment}_%04d.jpg`,
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    output,
  ]);
  for (let i = 0; i < count; i++) await ffmpeg.deleteFile(frameName(segment, i));
  return output;
}

type Report = (progress: ExportProgress) => void;

/**
 * Encodage par l'appareil (WebCodecs : encodeur matériel du téléphone ou de l'ordinateur) : chaque
 * image rendue est encodée directement, sans passer par des fichiers JPEG. Le son est encodé en
 * AAC par l'appareil s'il le sait, sinon ajouté ensuite par FFmpeg.
 */
async function encodeWithDevice(
  project: Project,
  frames: FrameSource,
  audio: AudioBuffer,
  signal: AbortSignal,
  onProgress: Report,
  getFfmpeg: () => Promise<FFmpeg>,
  /** Son encodé par l'appareil (sinon ajouté par FFmpeg). */
  soundOnDevice: boolean,
): Promise<Blob> {
  const total = frameCount(project);
  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible.');

  const withAudio = soundOnDevice && (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: audio.sampleRate, bitrate: AUDIO_BITRATE }));
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: 'avc', bitrate: VIDEO_BITRATE, keyFrameInterval: KEYFRAME_INTERVAL_S });
  output.addVideoTrack(video, { frameRate: project.fps });
  const sound = withAudio ? new AudioBufferSource({ codec: 'aac', bitrate: AUDIO_BITRATE }) : null;
  if (sound) output.addAudioTrack(sound);
  const cancel = () => void output.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await output.start();
    if (sound) {
      await sound.add(audio);
      sound.close();
    }
    for (let i = 0; i < total; i++) {
      signal.throwIfAborted();
      await frames.draw(ctx, (i * 1000) / project.fps);
      await video.add(i / project.fps, 1 / project.fps);
      onProgress({ ratio: 0.05 + 0.9 * ((i + 1) / total), stage: 'video' });
    }
    video.close();
    onProgress({ ratio: 0.96, stage: 'finalize' });
    await output.finalize();
  } finally {
    signal.removeEventListener('abort', cancel);
  }
  const data = output.target.buffer;
  if (!data) throw new Error('Fichier exporté illisible.');
  if (withAudio) return new Blob([data], { type: 'video/mp4' });

  // Son ajouté par FFmpeg (AAC), la vidéo est recopiée telle quelle.
  const ffmpeg = await getFfmpeg();
  await ffmpeg.writeFile('video.mp4', new Uint8Array(data));
  await ffmpeg.writeFile('audio.wav', encodeWav(audio));
  await run(ffmpeg, ['-i', 'video.mp4', '-i', 'audio.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4']);
  const muxed = await ffmpeg.readFile('out.mp4');
  if (typeof muxed === 'string') throw new Error('Fichier exporté illisible.');
  return new Blob([muxed.slice()], { type: 'video/mp4' });
}

/**
 * Encodage par FFmpeg (navigateurs sans encodeur vidéo WebCodecs) : images rendues en JPEG,
 * encodées par segments (l'encodage d'un segment se fait pendant le rendu du suivant), puis
 * concaténées avec le son.
 */
async function encodeWithFfmpeg(project: Project, frames: FrameSource, audio: AudioBuffer, signal: AbortSignal, onProgress: Report, ffmpeg: FFmpeg): Promise<Blob> {
  const total = frameCount(project);
  await ffmpeg.writeFile('audio.wav', encodeWav(audio));
  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible.');

  let rendered = 0;
  let encoded = 0;
  /** Images du segment en cours d'encodage, et part déjà encodée (progression rapportée par FFmpeg). */
  let encodingCount = 0;
  let encodingRatio = 0;
  const report = () =>
    onProgress({
      ratio: 0.05 + 0.9 * ((rendered + encoded + encodingRatio * encodingCount) / (2 * total)),
      stage: 'video',
    });
  ffmpeg.on('progress', ({ progress }) => {
    if (encodingCount === 0) return;
    encodingRatio = Math.min(1, Math.max(0, progress));
    report();
  });
  report();

  const segments: string[] = [];
  let encoding: Promise<void> = Promise.resolve();
  for (let segment = 0; segment * SEGMENT_FRAMES < total; segment++) {
    const first = segment * SEGMENT_FRAMES;
    const count = Math.min(SEGMENT_FRAMES, total - first);
    const jpegs: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      signal.throwIfAborted();
      await frames.draw(ctx, ((first + i) * 1000) / project.fps);
      jpegs.push(canvasToJpeg(canvas));
      rendered++;
      report();
    }
    await encoding;
    for (const [i, jpeg] of jpegs.entries()) await ffmpeg.writeFile(frameName(segment, i), jpeg);
    encodingCount = count;
    encodingRatio = 0;
    encoding = encodeSegment(ffmpeg, segment, count, project.fps).then((name) => {
      segments.push(name);
      encoded += count;
      encodingCount = 0;
      encodingRatio = 0;
      report();
    });
    // Évite un avertissement de promesse rejetée non gérée : l'erreur est relancée par le `await` suivant.
    encoding.catch(() => undefined);
  }
  await encoding;

  signal.throwIfAborted();
  onProgress({ ratio: 0.96, stage: 'finalize' });
  await ffmpeg.writeFile('list.txt', segments.map((name) => `file '${name}'`).join('\n'));
  await run(ffmpeg, [
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-i', 'audio.wav',
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    'out.mp4',
  ]);
  const data = await ffmpeg.readFile('out.mp4');
  if (typeof data === 'string') throw new Error('Fichier exporté illisible.');
  return new Blob([data.slice()], { type: 'video/mp4' });
}

/** Raison d'un échec, lisible (nom technique compris quand le message est vide). */
function errorText(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.message}${error.name && error.name !== 'Error' ? ` (${error.name})` : ''}` : error.name;
  return String(error);
}

/** Vrai si l'appareil sait encoder la vidéo en H.264 à la taille du projet (WebCodecs). */
async function deviceCanEncode(project: Project): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    return await canEncodeVideo('avc', { width: project.width, height: project.height, bitrate: VIDEO_BITRATE });
  } catch {
    return false;
  }
}

/**
 * Exporte le projet en MP4 H.264 + AAC. Les images sont rendues par le même moteur que l'aperçu,
 * puis encodées par l'appareil (rapide) ou, à défaut, par FFmpeg.
 */
export async function exportProject(project: Project, { onProgress, signal }: ExportOptions): Promise<ExportResult> {
  if (frameCount(project) === 0) throw new Error('Le projet est vide.');

  // FFmpeg n'est chargé que s'il sert : sans encodeur de l'appareil, son à accélérer, ou son à ajouter.
  let ffmpeg: FFmpeg | null = null;
  let loading: Promise<FFmpeg> | null = null;
  const getFfmpeg = () => {
    loading ??= (async () => {
      const instance = new FFmpeg();
      ffmpeg = instance;
      await loadEncoder(instance);
      return instance;
    })();
    return loading;
  };
  const stop = () => ffmpeg?.terminate();
  signal.addEventListener('abort', stop, { once: true });

  try {
    signal.throwIfAborted();
    onProgress({ ratio: 0, stage: 'prepare' });
    const [cutoutReady, device] = await Promise.all([usesCutout(project) ? loadSegmenter() : true, deviceCanEncode(project), loadFonts()]);
    if (!cutoutReady) throw new Error('Le détourage n’a pas pu démarrer sur cet appareil.');

    signal.throwIfAborted();
    onProgress({ ratio: 0.02, stage: 'audio' });
    const silentMedia: string[] = [];
    const audio = await mixProjectAudio(
      project,
      signal,
      async (segment, speed) => stretchAudio(await getFfmpeg(), segment, speed),
      (name) => silentMedia.push(name),
    );

    // Du plus rapide au plus sûr : si une méthode échoue sur cet appareil, la suivante prend le relais.
    type Attempt = (frames: FrameSource) => Promise<Blob>;
    const attempts: Attempt[] = [];
    if (device) {
      attempts.push((frames) => encodeWithDevice(project, frames, audio, signal, onProgress, getFfmpeg, true));
      attempts.push((frames) => encodeWithDevice(project, frames, audio, signal, onProgress, getFfmpeg, false));
    }
    attempts.push(async (frames) => encodeWithFfmpeg(project, frames, audio, signal, onProgress, await getFfmpeg()));
    const failures: string[] = [];
    for (const attempt of attempts) {
      signal.throwIfAborted();
      const frames = new FrameSource(project);
      try {
        const blob = await attempt(frames);
        onProgress({ ratio: 1, stage: 'finalize' });
        return { blob, silentMedia };
      } catch (error) {
        if (signal.aborted) throw error;
        failures.push(errorText(error));
      } finally {
        frames.dispose();
      }
    }
    // Toutes les méthodes ont échoué : chaque raison est donnée (utile pour comprendre le problème).
    throw new Error(failures.join(' / '));
  } catch (error) {
    if (signal.aborted) throw new ExportCancelledError();
    throw error;
  } finally {
    signal.removeEventListener('abort', stop);
    if (!signal.aborted) (ffmpeg as FFmpeg | null)?.terminate();
  }
}
