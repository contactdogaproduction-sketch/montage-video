import { clipMediaId, sourceTimeAt } from '../../core/clip';
import { visibleLayers, type Layer, type SourceSlot } from '../../core/composition';
import type { MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { createVideoElement, primeVideo, seekVideo, waitForEvent } from '../mediaElement';
import { loadLogo } from '../logo';
import { drawFrame, type SourceResolver } from '../render';
import { putMask, requestMask } from '../segmentation';

/** Délai maximal de chargement d'un média ou d'un positionnement pendant l'export. */
const MEDIA_TIMEOUT_MS = 20_000;

/** Attend un événement ; un échec devient un message compréhensible dans la fenêtre d'export. */
async function expect(target: EventTarget, event: string, name: string): Promise<void> {
  try {
    await waitForEvent(target, event, MEDIA_TIMEOUT_MS);
  } catch {
    throw new Error(`Lecture de « ${name} » impossible pendant l’export.`);
  }
}

const videoKey = (mediaId: string, slot: SourceSlot) => `${mediaId}#${slot}`;
const maskKey = (layer: Layer) => `${layer.clip.id}#${layer.slot}`;

/** Rendu image par image pour l'export : chaque vidéo visible est positionnée exactement avant le dessin. */
export class FrameSource {
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  /** Détourage : masques de l'image en cours, par clip et lecteur. */
  private readonly masks = new Map<string, HTMLCanvasElement>();

  constructor(private readonly project: Project) {}

  async draw(ctx: CanvasRenderingContext2D, t: Ms): Promise<void> {
    for (const { clip, slot } of visibleLayers(this.project, t)) {
      const mediaId = clipMediaId(clip);
      const media = mediaId ? this.project.media[mediaId] : undefined;
      if (!media) continue;
      if (media.kind === 'video' && clip.type === 'media') {
        const video = await this.video(media, slot);
        try {
          await seekVideo(video, sourceTimeAt(clip, t) / 1000, MEDIA_TIMEOUT_MS);
        } catch {
          throw new Error(`Lecture de « ${media.name} » impossible pendant l’export.`);
        }
      } else if (media.kind === 'image') {
        await this.image(media);
      }
    }
    const resolve: SourceResolver = (layer, m) => (m.kind === 'video' ? this.videos.get(videoKey(m.id, layer.slot)) : this.images.get(m.id)) ?? null;
    // Détourage exact de chaque image exportée, calculé avant le dessin.
    const masked = new Set<string>();
    for (const layer of visibleLayers(this.project, t)) {
      const { clip } = layer;
      if (clip.type !== 'media' || !(clip.removeBackground || layer.effect?.cutout)) continue;
      const key = maskKey(layer);
      const media = this.project.media[clip.mediaId];
      const source = media ? resolve(layer, media) : null;
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
      masks: (layer) => (masked.has(maskKey(layer)) ? (this.masks.get(maskKey(layer)) ?? null) : null),
      logo,
    });
  }

  dispose(): void {
    for (const video of this.videos.values()) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.videos.clear();
    this.images.clear();
    this.masks.clear();
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
