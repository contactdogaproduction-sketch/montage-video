import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputVideoTrack, type WrappedCanvas } from 'mediabunny';
import { clipEnd, clipMediaId, sourceTimeAt } from '../../core/clip';
import { visibleLayers, type Layer, type SourceSlot } from '../../core/composition';
import type { MediaClip, MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { createVideoElement, primeVideo, seekVideo, waitForEvent } from '../mediaElement';
import { loadLogo } from '../logo';
import { drawFrame, type SourceResolver } from '../render';
import { putMask, requestMask } from '../segmentation';

/** Délai maximal de chargement d'un média ou d'un positionnement pendant l'export. */
const MEDIA_TIMEOUT_MS = 20_000;
/** Images décodées d'avance et gardées par clip (mémoire bornée sur téléphone). */
const CANVAS_POOL = 3;

/** Attend un événement ; un échec devient un message compréhensible dans la fenêtre d'export. */
async function expect(target: EventTarget, event: string, name: string): Promise<void> {
  try {
    await waitForEvent(target, event, MEDIA_TIMEOUT_MS);
  } catch {
    throw new Error(`Lecture de « ${name} » impossible pendant l’export.`);
  }
}

const videoKey = (mediaId: string, slot: SourceSlot) => `${mediaId}#${slot}`;
const layerKey = (layer: Layer) => `${layer.clip.id}#${layer.slot}`;

/** Vidéo décodée image par image (WebCodecs, matériel de l'appareil). */
interface DecodedVideo {
  input: Input;
  track: InputVideoTrack;
  width: number;
  height: number;
}

/** Images d'un clip, décodées dans l'ordre pour toutes les images exportées où il apparaît. */
interface ClipFrames {
  frames: AsyncGenerator<WrappedCanvas | null, void, unknown>;
  /** Image exportée correspondant à `canvas`. */
  frame: number;
  canvas: CanvasImageSource | null;
}

/**
 * Rendu image par image pour l'export. Chaque vidéo est décodée dans l'ordre par WebCodecs, sans
 * repositionnement (lent sur les vidéos de téléphone) ; si le navigateur ne sait pas la décoder,
 * un lecteur vidéo est repositionné exactement à chaque image.
 */
export class FrameSource {
  private readonly decoded = new Map<string, Promise<DecodedVideo | null>>();
  private readonly clipFrames = new Map<string, ClipFrames>();
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  /** Détourage : masques de l'image en cours, par clip et lecteur. */
  private readonly masks = new Map<string, HTMLCanvasElement>();

  constructor(private readonly project: Project) {}

  async draw(ctx: CanvasRenderingContext2D, t: Ms): Promise<void> {
    const frame = Math.round((t * this.project.fps) / 1000);
    const sources = new Map<string, CanvasImageSource | null>();
    for (const layer of visibleLayers(this.project, t)) {
      const { clip, slot } = layer;
      const key = layerKey(layer);
      const mediaId = clipMediaId(clip);
      const media = mediaId ? this.project.media[mediaId] : undefined;
      if (!media || sources.has(key)) continue;
      if (media.kind === 'video' && clip.type === 'media') {
        const decoded = await this.decodedVideo(media);
        const image = decoded ? await this.decodedFrame(clip, slot, decoded, frame, media) : undefined;
        if (image !== undefined) {
          sources.set(key, image);
        } else {
          const video = await this.video(media, slot);
          try {
            await seekVideo(video, sourceTimeAt(clip, t) / 1000, MEDIA_TIMEOUT_MS);
          } catch {
            throw new Error(`Lecture de « ${media.name} » impossible pendant l’export.`);
          }
          sources.set(key, video);
        }
      } else if (media.kind === 'image') {
        sources.set(key, await this.image(media));
      }
    }
    this.releaseFinishedClips(frame);

    const resolve: SourceResolver = (layer) => sources.get(layerKey(layer)) ?? null;
    // Détourage exact de chaque image exportée, calculé avant le dessin.
    const masked = new Set<string>();
    for (const layer of visibleLayers(this.project, t)) {
      const { clip } = layer;
      if (clip.type !== 'media' || !(clip.removeBackground || layer.effect?.cutout)) continue;
      const key = layerKey(layer);
      const source = sources.get(key);
      if (masked.has(key) || !source) continue;
      const mask = await requestMask(source);
      if (!mask) throw new Error('Le détourage a échoué pendant l’export.');
      let canvas = this.masks.get(key);
      if (!canvas) {
        canvas = document.createElement('canvas');
        this.masks.set(key, canvas);
      }
      putMask(canvas, mask);
      masked.add(key);
    }
    const logo = this.project.watermark ? await loadLogo() : null;
    drawFrame(ctx, this.project, t, resolve, {
      masks: (layer) => (masked.has(layerKey(layer)) ? (this.masks.get(layerKey(layer)) ?? null) : null),
      logo,
    });
  }

  dispose(): void {
    for (const entry of this.clipFrames.values()) void entry.frames.return();
    this.clipFrames.clear();
    for (const decoded of this.decoded.values()) void decoded.then((d) => d?.input.dispose());
    this.decoded.clear();
    for (const video of this.videos.values()) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.videos.clear();
    this.images.clear();
    this.masks.clear();
  }

  /** Prépare le décodage d'une vidéo, ou `null` si le navigateur ne sait pas la décoder. */
  private decodedVideo(media: MediaInfo): Promise<DecodedVideo | null> {
    let decoded = this.decoded.get(media.id);
    if (!decoded) {
      decoded = this.openVideo(media);
      this.decoded.set(media.id, decoded);
    }
    return decoded;
  }

  private async openVideo(media: MediaInfo): Promise<DecodedVideo | null> {
    const source = getMediaSource(media.id);
    if (!source) throw new Error(`Fichier introuvable : ${media.name}`);
    if (typeof VideoDecoder === 'undefined') return null;
    const input = new Input({ source: new BlobSource(source.file), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) {
        input.dispose();
        return null;
      }
      // Images décodées à la taille de l'export au plus (une vidéo 4K est réduite dès le décodage).
      const maxSide = Math.max(this.project.width, this.project.height);
      const scale = Math.min(1, maxSide / Math.max(track.displayWidth, track.displayHeight));
      const width = Math.max(2, Math.round(track.displayWidth * scale));
      const height = Math.max(2, Math.round(track.displayHeight * scale));
      return { input, track, width, height };
    } catch {
      input.dispose();
      return null;
    }
  }

  /**
   * Image du clip pour l'image exportée n° `frame` (les images du clip sont décodées dans l'ordre).
   * `undefined` si le décodage échoue : la vidéo passe alors au lecteur repositionné à chaque image.
   */
  private async decodedFrame(clip: MediaClip, slot: SourceSlot, decoded: DecodedVideo, frame: number, media: MediaInfo): Promise<CanvasImageSource | null | undefined> {
    try {
      return await this.nextDecodedFrame(clip, slot, decoded, frame);
    } catch {
      for (const [key, entry] of this.clipFrames) {
        if (!key.startsWith(`${clip.id}#`)) continue;
        void entry.frames.return().catch(() => undefined);
        this.clipFrames.delete(key);
      }
      this.decoded.set(media.id, Promise.resolve(null));
      decoded.input.dispose();
      return undefined;
    }
  }

  private async nextDecodedFrame(clip: MediaClip, slot: SourceSlot, decoded: DecodedVideo, frame: number): Promise<CanvasImageSource | null> {
    const key = `${clip.id}#${slot}`;
    let entry = this.clipFrames.get(key);
    if (!entry) {
      // Instants de la source pour chaque image exportée où le clip apparaît, à partir de celle-ci.
      const fps = this.project.fps;
      const end = clipEnd(clip);
      const timestamps: number[] = [];
      for (let f = frame; (f * 1000) / fps < end; f++) timestamps.push(sourceTimeAt(clip, (f * 1000) / fps) / 1000);
      const sink = new CanvasSink(decoded.track, { width: decoded.width, height: decoded.height, fit: 'fill', poolSize: CANVAS_POOL });
      entry = { frames: sink.canvasesAtTimestamps(timestamps), frame: frame - 1, canvas: null };
      this.clipFrames.set(key, entry);
    }
    while (entry.frame < frame) {
      const next = await entry.frames.next();
      entry.frame += 1;
      if (next.done) break;
      if (next.value) entry.canvas = next.value.canvas;
    }
    return entry.canvas;
  }

  /** Libère le décodage des clips terminés (mémoire du téléphone). */
  private releaseFinishedClips(frame: number): void {
    for (const [key, entry] of this.clipFrames) {
      if (entry.frame >= frame - 1) continue;
      void entry.frames.return();
      this.clipFrames.delete(key);
    }
  }

  private async video(media: MediaInfo, slot: SourceSlot): Promise<HTMLVideoElement> {
    const key = videoKey(media.id, slot);
    const existing = this.videos.get(key);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) throw new Error(`Fichier introuvable : ${media.name}`);
    const video = createVideoElement(source.url, true);
    if (video.readyState < 1) await expect(video, 'loadedmetadata', media.name);
    // iPhone : une lecture muette brève est nécessaire pour que les images soient disponibles.
    await primeVideo(video);
    if (video.readyState < 2) await expect(video, 'loadeddata', media.name);
    this.videos.set(key, video);
    return video;
  }

  private async image(media: MediaInfo): Promise<HTMLImageElement> {
    const existing = this.images.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) throw new Error(`Fichier introuvable : ${media.name}`);
    const img = new Image();
    const loaded = expect(img, 'load', media.name);
    img.src = source.url;
    await loaded;
    this.images.set(media.id, img);
    return img;
  }
}
