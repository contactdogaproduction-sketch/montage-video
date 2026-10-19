import { clipEnd, sourceTimeAt } from '../../core/clip';
import { getMainTrack, projectDuration } from '../../core/project';
import { findClipAt } from '../../core/track';
import type { Clip, MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { drawFrame } from '../render';

/** Écart toléré entre l'horloge et la vidéo avant de forcer un repositionnement (s). */
const RESYNC_THRESHOLD_S = 0.3;
/** Délai avant la fin d'un clip pour préparer la vidéo suivante (ms). */
const PRELOAD_MS = 1000;

interface PlayerCallbacks {
  onTime: (t: Ms) => void;
  onEnded: () => void;
}

/**
 * Lecteur de l'aperçu : compose le projet sur le canvas et synchronise les éléments vidéo
 * (qui portent aussi le son) avec le temps de la timeline.
 */
export class PreviewPlayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  private project: Project;
  private time: Ms = 0;
  private playing = false;
  /** Point d'ancrage de l'horloge de lecture : temps timeline ↔ performance.now(). */
  private anchorTime: Ms = 0;
  private anchorNow = 0;
  private dirty = true;
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    project: Project,
    private readonly callbacks: PlayerCallbacks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    this.ctx = ctx;
    this.project = project;
    this.frame = requestAnimationFrame(this.tick);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentTime(): Ms {
    return this.time;
  }

  setProject(project: Project): void {
    this.project = project;
    if (!this.playing) this.syncPaused();
    this.dirty = true;
  }

  seek(t: Ms): void {
    this.time = t;
    this.anchorTime = t;
    this.anchorNow = performance.now();
    if (!this.playing) this.syncPaused();
    this.dirty = true;
  }

  /** À appeler depuis un geste utilisateur (politique de lecture automatique des navigateurs). */
  play(): void {
    if (this.playing) return;
    if (this.time >= projectDuration(this.project)) this.time = 0;
    this.playing = true;
    this.anchorTime = this.time;
    this.anchorNow = performance.now();
    this.syncPlaying(this.time);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    for (const video of this.videos.values()) video.pause();
    this.dirty = true;
  }

  /** Taille du canvas en pixels réels ; le dessin reste dans le repère du projet. */
  resize(cssWidth: number, cssHeight: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.dirty = true;
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const video of this.videos.values()) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.videos.clear();
    this.images.clear();
  }

  private readonly markDirty = () => {
    this.dirty = true;
  };

  private video(media: MediaInfo): HTMLVideoElement | null {
    const existing = this.videos.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) return null;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.src = source.url;
    video.addEventListener('loadeddata', this.markDirty);
    video.addEventListener('seeked', this.markDirty);
    this.videos.set(media.id, video);
    return video;
  }

  private image(media: MediaInfo): HTMLImageElement | null {
    const existing = this.images.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) return null;
    const img = new Image();
    img.addEventListener('load', this.markDirty);
    img.src = source.url;
    this.images.set(media.id, img);
    return img;
  }

  /** Temps affiché : en fin de projet, on montre la dernière image plutôt que du noir. */
  private displayTime(): Ms {
    const duration = projectDuration(this.project);
    return duration > 0 ? Math.min(this.time, duration - 1) : this.time;
  }

  private activeClip(t: Ms): { clip: Clip; media: MediaInfo } | null {
    const clip = findClipAt(getMainTrack(this.project), t);
    const media = clip ? this.project.media[clip.mediaId] : undefined;
    return clip && media ? { clip, media } : null;
  }

  private pauseOthers(keep: HTMLVideoElement | null): void {
    for (const video of this.videos.values()) {
      if (video !== keep && !video.paused) video.pause();
    }
  }

  /** À l'arrêt : positionne la vidéo du clip courant sur la bonne image. */
  private syncPaused(): void {
    const t = this.displayTime();
    const active = this.activeClip(t);
    this.pauseOthers(null);
    if (!active || active.media.kind !== 'video') return;
    const video = this.video(active.media);
    if (!video) return;
    const target = sourceTimeAt(active.clip, t) / 1000;
    if (Math.abs(video.currentTime - target) > 0.001) video.currentTime = target;
  }

  private syncPlaying(t: Ms): void {
    const active = this.activeClip(t);
    const video = active?.media.kind === 'video' ? this.video(active.media) : null;
    this.pauseOthers(video);
    if (!active || !video) return;

    const target = sourceTimeAt(active.clip, t) / 1000;
    if (Math.abs(video.currentTime - target) > RESYNC_THRESHOLD_S) video.currentTime = target;
    if (video.paused) void video.play().catch(() => undefined);

    // Prépare la vidéo du clip suivant pour un enchaînement sans attente.
    const end = clipEnd(active.clip);
    if (end - t < PRELOAD_MS) {
      const next = this.activeClip(end);
      if (next && next.media.kind === 'video') {
        const nextVideo = this.video(next.media);
        const nextTarget = next.clip.inPoint / 1000;
        if (nextVideo && nextVideo !== video && Math.abs(nextVideo.currentTime - nextTarget) > 0.05) {
          nextVideo.currentTime = nextTarget;
        }
      }
    }
  }

  private readonly tick = (now: number) => {
    if (this.playing) this.advance(now);
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private advance(now: number): void {
    let t = this.anchorTime + (now - this.anchorNow);

    // La vidéo en cours sert d'horloge maître quand elle joue normalement (évite la dérive son/image).
    const active = this.activeClip(this.time);
    if (active?.media.kind === 'video') {
      const video = this.videos.get(active.media.id);
      if (video && !video.paused && !video.seeking && video.readyState >= 3) {
        const videoTime = active.clip.start + video.currentTime * 1000 - active.clip.inPoint;
        if (Math.abs(videoTime - t) < 500) {
          t = videoTime;
          this.anchorTime = t;
          this.anchorNow = now;
        }
      }
    }

    const duration = projectDuration(this.project);
    if (t >= duration) {
      this.time = duration;
      this.pause();
      this.callbacks.onTime(duration);
      this.callbacks.onEnded();
      return;
    }
    this.time = t;
    this.syncPlaying(t);
    this.callbacks.onTime(t);
    this.dirty = true;
  }

  private readySource(media: MediaInfo): CanvasImageSource | null {
    if (media.kind === 'image') {
      const img = this.image(media);
      return img?.complete && img.naturalWidth > 0 ? img : null;
    }
    const video = this.video(media);
    return video && video.readyState >= 2 && !video.seeking ? video : null;
  }

  private draw(): void {
    const { ctx, canvas, project } = this;
    // Source pas encore prête (chargement, repositionnement) : on garde l'image précédente
    // plutôt qu'un flash noir ; l'événement `seeked`/`load` redemandera un dessin.
    const t = this.displayTime();
    const active = this.activeClip(t);
    if (active && !this.readySource(active.media)) return;
    ctx.setTransform(canvas.width / project.width, 0, 0, canvas.height / project.height, 0, 0);
    drawFrame(ctx, project, t, (_clip, media) => this.readySource(media));
  }
}
