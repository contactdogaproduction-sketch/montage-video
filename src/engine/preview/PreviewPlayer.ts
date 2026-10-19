import { clipGainAt } from '../../core/audio';
import { clipMediaId, sourceTimeAt } from '../../core/clip';
import { projectDuration } from '../../core/project';
import { findClipAt } from '../../core/track';
import type { MediaClip, MediaInfo, Ms, Project, Track } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { loadFonts } from '../fonts';
import { createVideoElement, primeVideo } from '../mediaElement';
import { drawFrame, visibleClips } from '../render';

/** Écart toléré entre l'horloge et un média avant de forcer un repositionnement (s). */
const RESYNC_THRESHOLD_S = 0.3;
/** Délai avant le début d'un clip pour préparer son média (ms). */
const PRELOAD_MS = 1000;

interface PlayerCallbacks {
  onTime: (t: Ms) => void;
  onEnded: () => void;
}

interface ActiveMedia {
  track: Track;
  clip: MediaClip;
  media: MediaInfo;
}

/**
 * Lecteur de l'aperçu : compose le projet sur le canvas et synchronise les éléments vidéo et audio
 * avec le temps de la timeline. Le son passe par la Web Audio API (volumes jusqu'à 200 %).
 */
export class PreviewPlayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly players = new Map<string, HTMLMediaElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly gains = new Map<string, GainNode>();
  private audio: AudioContext | null = null;
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
    void loadFonts().then(this.markDirty);
    document.fonts.addEventListener('loadingdone', this.markDirty);
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
    this.ensureAudioGraph();
    if (this.time >= projectDuration(this.project)) this.time = 0;
    this.playing = true;
    this.anchorTime = this.time;
    this.anchorNow = performance.now();
    this.syncPlaying(this.time);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    for (const player of this.players.values()) player.pause();
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
    document.fonts.removeEventListener('loadingdone', this.markDirty);
    for (const player of this.players.values()) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    this.players.clear();
    this.images.clear();
    this.gains.clear();
    void this.audio?.close();
  }

  private readonly markDirty = () => {
    this.dirty = true;
  };

  /** Crée le contexte audio (dans le geste de lecture) et y raccorde les éléments existants. */
  private ensureAudioGraph(): void {
    // iPhone : sans cela, le mode silencieux coupe le son passé par la Web Audio API.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    if (!this.audio) {
      this.audio = new AudioContext();
      for (const [mediaId, player] of this.players) this.connect(mediaId, player);
    }
    if (this.audio.state === 'suspended') void this.audio.resume();
  }

  private connect(mediaId: string, player: HTMLMediaElement): void {
    if (!this.audio || this.gains.has(mediaId)) return;
    const gain = this.audio.createGain();
    this.audio.createMediaElementSource(player).connect(gain).connect(this.audio.destination);
    this.gains.set(mediaId, gain);
  }

  private player(media: MediaInfo): HTMLMediaElement | null {
    const existing = this.players.get(media.id);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) return null;
    let player: HTMLMediaElement;
    if (media.kind === 'audio') {
      player = document.createElement('audio');
      player.preload = 'auto';
      player.src = source.url;
    } else {
      const video = createVideoElement(source.url, false);
      // iPhone : sans lecture préalable, la vidéo n'a aucune image à dessiner à l'arrêt.
      void primeVideo(video, () => !this.playing).then(() => {
        if (!this.playing) this.syncPaused();
        this.dirty = true;
      });
      player = video;
    }
    player.addEventListener('loadeddata', this.markDirty);
    player.addEventListener('seeked', this.markDirty);
    this.players.set(media.id, player);
    this.connect(media.id, player);
    return player;
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

  private mediaClipOf(track: Track, t: Ms): ActiveMedia | null {
    const clip = findClipAt(track, t);
    if (!clip || clip.type !== 'media') return null;
    const media = this.project.media[clip.mediaId];
    return media && media.kind !== 'image' ? { track, clip, media } : null;
  }

  /** Clips vidéo et audio en cours au temps `t`, piste principale en premier. */
  private activeMedia(t: Ms): ActiveMedia[] {
    return this.project.tracks.map((track) => this.mediaClipOf(track, t)).filter((a): a is ActiveMedia => a !== null);
  }

  /** À l'arrêt : positionne les vidéos visibles sur la bonne image. */
  private syncPaused(): void {
    for (const player of this.players.values()) if (!player.paused) player.pause();
    const t = this.displayTime();
    for (const active of this.activeMedia(t)) {
      if (active.media.kind !== 'video') continue;
      const player = this.player(active.media);
      const target = sourceTimeAt(active.clip, t) / 1000;
      if (player && Math.abs(player.currentTime - target) > 0.001) player.currentTime = target;
    }
  }

  private syncPlaying(t: Ms): void {
    const used = new Set<HTMLMediaElement>();
    for (const { track, clip, media } of this.activeMedia(t)) {
      const player = this.player(media);
      if (!player || used.has(player)) continue;
      used.add(player);
      const target = sourceTimeAt(clip, t) / 1000;
      if (Math.abs(player.currentTime - target) > RESYNC_THRESHOLD_S) player.currentTime = target;
      const gain = clipGainAt(clip, track.volume, t);
      const node = this.gains.get(media.id);
      if (node) node.gain.value = gain;
      else player.volume = Math.min(1, gain);
      if (player.paused) void player.play().catch(() => undefined);
    }
    for (const player of this.players.values()) if (!used.has(player) && !player.paused) player.pause();

    // Prépare les médias des clips qui commencent bientôt, pour un enchaînement sans attente.
    for (const track of this.project.tracks) {
      const next = this.mediaClipOf(track, t + PRELOAD_MS);
      if (!next || next.clip.start <= t) continue;
      const player = this.player(next.media);
      const target = next.clip.inPoint / 1000;
      if (player && !used.has(player) && Math.abs(player.currentTime - target) > 0.05) player.currentTime = target;
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

    // Le premier média en cours sert d'horloge maître quand il joue normalement (évite la dérive son/image).
    const master = this.activeMedia(this.time)[0];
    const player = master ? this.players.get(master.media.id) : undefined;
    if (master && player && !player.paused && !player.seeking && player.readyState >= 3) {
      const mediaTime = master.clip.start + player.currentTime * 1000 - master.clip.inPoint;
      if (Math.abs(mediaTime - t) < 500) {
        t = mediaTime;
        this.anchorTime = t;
        this.anchorNow = now;
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
    const player = this.player(media);
    return player instanceof HTMLVideoElement && player.readyState >= 2 && !player.seeking ? player : null;
  }

  private draw(): void {
    const { ctx, canvas, project } = this;
    const t = this.displayTime();
    // Une source pas encore prête (chargement, repositionnement) : on garde l'image précédente
    // plutôt qu'un flash ; les événements `seeked` / `load` redemandent un dessin.
    for (const { clip } of visibleClips(project, t)) {
      const mediaId = clipMediaId(clip);
      const media = mediaId ? project.media[mediaId] : undefined;
      if (media && media.kind !== 'audio' && !this.readySource(media)) return;
    }
    ctx.setTransform(canvas.width / project.width, 0, 0, canvas.height / project.height, 0, 0);
    drawFrame(ctx, project, t, (media) => this.readySource(media));
  }
}
