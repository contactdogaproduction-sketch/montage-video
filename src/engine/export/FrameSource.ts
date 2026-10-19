import { clipMediaId, sourceTimeAt } from '../../core/clip';
import type { MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { createVideoElement, primeVideo, seekVideo, waitForEvent } from '../mediaElement';
import { drawFrame, visibleClips } from '../render';

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

/** Rendu image par image pour l'export : chaque vidéo visible est positionnée exactement avant le dessin. */
export class FrameSource {
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();

  constructor(private readonly project: Project) {}

  async draw(ctx: CanvasRenderingContext2D, t: Ms): Promise<void> {
    for (const { clip } of visibleClips(this.project, t)) {
      const mediaId = clipMediaId(clip);
      const media = mediaId ? this.project.media[mediaId] : undefined;
      if (!media) continue;
      if (media.kind === 'video' && clip.type === 'media') {
        const video = await this.video(media);
        try {
          await seekVideo(video, sourceTimeAt(clip, t) / 1000, MEDIA_TIMEOUT_MS);
        } catch {
          throw new Error(`Lecture de « ${media.name} » impossible pendant l’export.`);
        }
      } else if (media.kind === 'image') {
        await this.image(media);
      }
    }
    drawFrame(ctx, this.project, t, (m) => (m.kind === 'video' ? this.videos.get(m.id) : this.images.get(m.id)) ?? null);
  }

  dispose(): void {
    for (const video of this.videos.values()) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.videos.clear();
    this.images.clear();
  }

  private async video(media: MediaInfo): Promise<HTMLVideoElement> {
    const existing = this.videos.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) throw new Error(`Fichier introuvable : ${media.name}`);
    const video = createVideoElement(source.url, true);
    if (video.readyState < 1) await expect(video, 'loadedmetadata', media.name);
    // iPhone : une lecture muette brève est nécessaire pour que les images soient disponibles.
    await primeVideo(video);
    if (video.readyState < 2) await expect(video, 'loadeddata', media.name);
    this.videos.set(media.id, video);
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
