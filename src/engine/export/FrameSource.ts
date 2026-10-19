import { sourceTimeAt } from '../../core/clip';
import { getMainTrack } from '../../core/project';
import { findClipAt } from '../../core/track';
import type { MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { drawFrame } from '../render';

function once(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      target.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      target.removeEventListener(event, ok);
      reject(new Error('Lecture du média impossible pendant l’export.'));
    };
    target.addEventListener(event, ok, { once: true });
    target.addEventListener('error', fail, { once: true });
  });
}

/** Rendu image par image pour l'export : chaque vidéo est positionnée exactement avant le dessin. */
export class FrameSource {
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();

  constructor(private readonly project: Project) {}

  async draw(ctx: CanvasRenderingContext2D, t: Ms): Promise<void> {
    const clip = findClipAt(getMainTrack(this.project), t);
    const media = clip ? this.project.media[clip.mediaId] : undefined;
    if (clip && media?.kind === 'video') {
      const video = await this.video(media);
      await this.seek(video, sourceTimeAt(clip, t) / 1000);
    } else if (media?.kind === 'image') {
      await this.image(media);
    }
    drawFrame(ctx, this.project, t, (_c, m) => (m.kind === 'video' ? this.videos.get(m.id) : this.images.get(m.id)) ?? null);
  }

  dispose(): void {
    for (const video of this.videos.values()) {
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
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const loaded = once(video, 'loadeddata');
    video.src = source.url;
    await loaded;
    this.videos.set(media.id, video);
    return video;
  }

  private async image(media: MediaInfo): Promise<HTMLImageElement> {
    const existing = this.images.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) throw new Error(`Fichier introuvable : ${media.name}`);
    const img = new Image();
    const loaded = once(img, 'load');
    img.src = source.url;
    await loaded;
    this.images.set(media.id, img);
    return img;
  }

  private async seek(video: HTMLVideoElement, seconds: number): Promise<void> {
    const target = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.001));
    if (Math.abs(video.currentTime - target) < 0.0001 && video.readyState >= 2) return;
    const seeked = once(video, 'seeked');
    video.currentTime = target;
    await seeked;
  }
}
