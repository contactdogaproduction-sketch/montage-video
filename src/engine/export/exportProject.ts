import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { frameCount } from '../../core/project';
import type { Project } from '../../core/types';
import { loadFonts } from '../fonts';
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

export class ExportCancelledError extends Error {
  constructor() {
    super('Export annulé.');
  }
}

/** Images par segment : borne la mémoire utilisée (fichiers JPEG en mémoire de FFmpeg). */
const SEGMENT_FRAMES = 90;
const JPEG_QUALITY = 0.92;

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

/**
 * Exporte le projet en MP4 H.264 + AAC.
 * Les images sont rendues par le même moteur que l'aperçu, encodées par segments
 * (l'encodage d'un segment se fait pendant le rendu du suivant), puis concaténées.
 */
export async function exportProject(project: Project, { onProgress, signal }: ExportOptions): Promise<Blob> {
  const total = frameCount(project);
  if (total === 0) throw new Error('Le projet est vide.');

  const ffmpeg = new FFmpeg();
  const stop = () => ffmpeg.terminate();
  signal.addEventListener('abort', stop, { once: true });
  const frames = new FrameSource(project);

  try {
    signal.throwIfAborted();
    onProgress({ ratio: 0, stage: 'prepare' });
    await Promise.all([loadEncoder(ffmpeg), loadFonts()]);

    signal.throwIfAborted();
    onProgress({ ratio: 0.02, stage: 'audio' });
    const audio = await mixProjectAudio(project, signal);
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
    await ffmpeg.writeFile('list.txt', segments.map((s) => `file '${s}'`).join('\n'));
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
    onProgress({ ratio: 1, stage: 'finalize' });
    return new Blob([data.slice()], { type: 'video/mp4' });
  } catch (error) {
    if (signal.aborted) throw new ExportCancelledError();
    throw error;
  } finally {
    signal.removeEventListener('abort', stop);
    frames.dispose();
    if (!signal.aborted) ffmpeg.terminate();
  }
}
