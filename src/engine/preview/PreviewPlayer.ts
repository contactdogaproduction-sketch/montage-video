import { clipMediaId, sourceTimeAt } from '../../core/clip';
import { activeMediaClips, mediaPlayers, visibleLayers, type AudibleClip, type Layer, type SourceSlot } from '../../core/composition';
import { projectDuration } from '../../core/project';
import type { MediaInfo, Ms, Project } from '../../core/types';
import { getMediaSource, onMediaPreview } from '../../store/mediaRegistry';
import { loadFonts } from '../fonts';
import { createVideoElement, primeVideo } from '../mediaElement';
import { SpriteCache, drawFrame, type MaskResolver } from '../render';
import { LiveMasks, loadSegmenter, segmenterReady } from '../segmentation';

/** Écart toléré entre l'horloge et un média avant de forcer un repositionnement (s). */
// Un repositionnement provoque un à-coup visible : on ne recale qu'au-delà d'un écart net.
const RESYNC_THRESHOLD_S = 0.5;
/** Après un repositionnement, délai avant d'en autoriser un autre sur le même lecteur (ms). */
// Sans ce délai, un téléphone qui décode trop lentement enchaîne les repositionnements et n'avance plus.
const RESYNC_COOLDOWN_MS = 1500;
/** Avance donnée à un repositionnement en lecture : le temps que le lecteur retrouve l'image (s). */
const RESYNC_LEAD_S = 0.15;
/** Écart avec le média maître en deçà duquel l'horloge n'est pas corrigée (ms). */
const CLOCK_TOLERANCE_MS = 40;
/** Part de l'écart avec le média maître rattrapée à chaque image (correction en douceur). */
const CLOCK_CORRECTION = 0.15;
/** Marge de la minuterie de secours : un écran limité à 30 Hz (économie d'énergie) dessine chaque image. */
const TIMER_SLACK_MS = 8;
/** Sans nouvelle image de la vidéo depuis ce délai, la minuterie de secours reprend (vidéo bloquée). */
const VIDEO_FRAME_TIMEOUT_MS = 50;

type FrameCallbackVideo = HTMLVideoElement & { requestVideoFrameCallback: (callback: () => void) => number };

const hasFrameCallback = (video: HTMLVideoElement): video is FrameCallbackVideo => 'requestVideoFrameCallback' in video;
/** Délai avant le début d'un clip pour préparer son média (ms). */
const PRELOAD_MS = 1000;

interface PlayerCallbacks {
  onTime: (t: Ms) => void;
  onEnded: () => void;
}

/** Arrête un lecteur et libère son fichier. */
function release(player: HTMLMediaElement): void {
  player.pause();
  player.removeAttribute('src');
  player.load();
  player.remove();
}

/** Clé d'un lecteur : un média peut avoir deux lecteurs (transition entre deux morceaux d'une même vidéo). */
const playerKey = (mediaId: string, slot: SourceSlot) => `${mediaId}#${slot}`;

/**
 * Lecteur de l'aperçu : compose le projet sur le canvas et synchronise les éléments vidéo et audio
 * avec le temps de la timeline. Le son passe par la Web Audio API (volumes jusqu'à 200 %).
 */
export class PreviewPlayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly players = new Map<string, HTMLMediaElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly gains = new Map<string, GainNode>();
  /** Dernier niveau appliqué à chaque lecteur (modifier un gain à chaque image fait grésiller Safari). */
  private readonly levels = new Map<string, number>();
  /** Instant (performance.now) avant lequel un lecteur ne doit pas être repositionné. */
  private readonly resyncAfter = new Map<HTMLMediaElement, number>();
  private readonly sprites = new SpriteCache();
  // En lecture, le masque reçu sert à la prochaine image dessinée (pas de dessin en plus).
  private readonly masks = new LiveMasks(() => {
    if (!this.playing) this.dirty = true;
  });
  private segmenterRequested = false;
  /** Instant de la dernière image dessinée pendant la lecture. */
  private lastFrameAt = 0;
  /** Vidéo qui donne la cadence du dessin (média maître), et arrivée de ses images. */
  private masterVideo: HTMLVideoElement | null = null;
  private videoFrameReady = false;
  private lastVideoFrameAt = -Infinity;
  private readonly watchedVideos = new WeakSet<HTMLVideoElement>();
  /** Médias dont la copie allégée a été créée ou supprimée, à basculer dès que la lecture s'arrête. */
  private readonly pendingPreviews = new Set<string>();
  private readonly stopPreviewListener: () => void;
  private audio: AudioContext | null = null;
  private project: Project;
  private time: Ms = 0;
  private playing = false;
  /** Point d'ancrage de l'horloge de lecture : temps timeline ↔ performance.now(). */
  private anchorTime: Ms = 0;
  private anchorNow = 0;
  private dirty = true;
  private frame = 0;
  /** Son de l'aperçu coupé (enregistrement de la voix, pour éviter l'écho dans le micro). */
  private muted = false;
  /**
   * Conteneur invisible des éléments vidéo et audio : Safari sur iPhone décode mal (images
   * saccadées) les vidéos qui ne sont pas dans la page.
   */
  private readonly host: HTMLDivElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    project: Project,
    private readonly callbacks: PlayerCallbacks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    this.ctx = ctx;
    this.project = project;
    this.host = document.createElement('div');
    this.host.setAttribute('aria-hidden', 'true');
    this.host.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(this.host);
    void loadFonts().then(this.fontsChanged);
    document.fonts.addEventListener('loadingdone', this.fontsChanged);
    this.frame = requestAnimationFrame(this.tick);
    this.stopPreviewListener = onMediaPreview((mediaId) => {
      this.pendingPreviews.add(mediaId);
      if (!this.playing) this.usePreviews();
    });
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
    this.usePreviews();
    this.dirty = true;
  }

  /** Taille du canvas en pixels réels ; le dessin reste dans le repère du projet. */
  resize(cssWidth: number, cssHeight: number): void {
    // Densité limitée à 2 : au-delà (iPhone = 3), le surcoût de dessin n'apporte rien de visible.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.dirty = true;
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.stopPreviewListener();
    document.fonts.removeEventListener('loadingdone', this.fontsChanged);
    this.sprites.clear();
    this.masks.clear();
    for (const player of this.players.values()) release(player);
    this.players.clear();
    this.images.clear();
    this.gains.clear();
    this.levels.clear();
    this.host.remove();
    void this.audio?.close();
  }

  /** Coupe ou rétablit le son de l'aperçu. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.playing) this.syncPlaying(this.time);
  }

  private readonly markDirty = () => {
    this.dirty = true;
  };

  /** Police chargée : les textes déjà mis en cache l'avaient été avec une police de secours. */
  private readonly fontsChanged = () => {
    this.sprites.clear();
    this.dirty = true;
  };

  /** Crée le contexte audio (dans le geste de lecture) et y raccorde les éléments existants. */
  private ensureAudioGraph(): void {
    // iPhone : sans cela, le mode silencieux coupe le son passé par la Web Audio API.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    if (!this.audio) {
      this.audio = new AudioContext();
      for (const [key, player] of this.players) this.connect(key, player);
    }
    if (this.audio.state === 'suspended') void this.audio.resume();
  }

  private connect(key: string, player: HTMLMediaElement): void {
    if (!this.audio || this.gains.has(key)) return;
    const gain = this.audio.createGain();
    // Muet tant que son clip n'a pas commencé (un lecteur préparé d'avance peut démarrer brièvement).
    gain.gain.value = 0;
    this.levels.delete(key);
    this.audio.createMediaElementSource(player).connect(gain).connect(this.audio.destination);
    this.gains.set(key, gain);
  }

  /**
   * Remplace les lecteurs des vidéos dont la copie allégée vient d'être créée ou supprimée (à l'arrêt seulement :
   * changer de fichier en pleine lecture provoquerait un à-coup). Ils sont recréés à la demande.
   */
  private usePreviews(): void {
    if (this.pendingPreviews.size === 0) return;
    for (const [key, player] of this.players) {
      const mediaId = key.slice(0, key.lastIndexOf('#'));
      if (!this.pendingPreviews.has(mediaId)) continue;
      // Lecteur déjà sur le bon fichier : rien à changer.
      const source = getMediaSource(mediaId);
      if (source && player.src === (source.preview?.url ?? source.url)) continue;
      release(player);
      this.players.delete(key);
      this.gains.get(key)?.disconnect();
      this.gains.delete(key);
      this.levels.delete(key);
      this.resyncAfter.delete(player);
    }
    this.pendingPreviews.clear();
    this.syncPaused();
    this.dirty = true;
  }

  private player(media: MediaInfo, slot: SourceSlot): HTMLMediaElement | null {
    const key = playerKey(media.id, slot);
    const existing = this.players.get(key);
    if (existing) return existing;
    const source = getMediaSource(media.id);
    if (!source) return null;
    let player: HTMLMediaElement;
    if (media.kind === 'audio') {
      player = document.createElement('audio');
      player.preload = 'auto';
      player.src = source.url;
    } else {
      // Copie allégée quand elle existe : bien moins lourde à décoder (l'export garde l'original).
      const video = createVideoElement(source.preview?.url ?? source.url, false);
      // iPhone : sans lecture préalable, la vidéo n'a aucune image à dessiner à l'arrêt.
      void primeVideo(video, () => !this.playing).then(() => {
        if (!this.playing) this.syncPaused();
        this.dirty = true;
      });
      player = video;
    }
    player.addEventListener('loadeddata', this.markDirty);
    player.addEventListener('seeked', this.markDirty);
    this.host.appendChild(player);
    this.players.set(key, player);
    this.connect(key, player);
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

  /** À l'arrêt : positionne les vidéos visibles sur la bonne image. */
  private syncPaused(): void {
    for (const player of this.players.values()) if (!player.paused) player.pause();
    // Tous les lecteurs du projet sont créés à l'arrêt : en créer un pendant la lecture (morceau
    // suivant, incrustation) bloque la page un instant (à-coup visible).
    for (const { mediaId, slot } of mediaPlayers(this.project)) {
      const media = this.project.media[mediaId];
      if (media) this.player(media, slot);
    }
    const t = this.displayTime();
    for (const { clip, slot } of activeMediaClips(this.project, t)) {
      const media = this.project.media[clip.mediaId];
      if (!media || media.kind !== 'video') continue;
      const player = this.player(media, slot);
      const target = sourceTimeAt(clip, t) / 1000;
      if (player && Math.abs(player.currentTime - target) > 0.001) player.currentTime = target;
    }
  }

  private syncPlaying(t: Ms, active: AudibleClip[] = activeMediaClips(this.project, t)): void {
    const used = new Set<HTMLMediaElement>();
    const now = performance.now();
    for (const { clip, slot, gain } of active) {
      const media = this.project.media[clip.mediaId];
      const player = media ? this.player(media, slot) : null;
      if (!media || !player || used.has(player)) continue;
      used.add(player);
      const target = sourceTimeAt(clip, t) / 1000;
      const drift = Math.abs(player.currentTime - target);
      if (player.paused) {
        // Démarrage : un lecteur préparé d'avance (à 50 ms près) part sans repositionnement.
        if (drift > 0.05) player.currentTime = target;
      } else if (drift > RESYNC_THRESHOLD_S * clip.speed && now >= (this.resyncAfter.get(player) ?? 0)) {
        player.currentTime = target + RESYNC_LEAD_S * clip.speed;
        this.resyncAfter.set(player, now + RESYNC_COOLDOWN_MS);
      }
      // Vitesse du clip ; le navigateur garde la hauteur de la voix (preservesPitch, actif par défaut).
      if (player.playbackRate !== clip.speed) player.playbackRate = clip.speed;
      const key = playerKey(media.id, slot);
      const level = this.muted ? 0 : gain;
      if (this.levels.get(key) !== level) {
        this.levels.set(key, level);
        const node = this.gains.get(key);
        if (node) node.gain.value = level;
        else player.volume = Math.min(1, level);
      }
      if (player.paused) void player.play().catch(() => undefined);
    }
    for (const player of this.players.values()) if (!used.has(player) && !player.paused) player.pause();

    // Prépare les médias des clips qui commencent bientôt, pour un enchaînement sans attente.
    for (const { clip, slot } of activeMediaClips(this.project, t + PRELOAD_MS)) {
      if (clip.start <= t) continue;
      const media = this.project.media[clip.mediaId];
      const player = media ? this.player(media, slot) : null;
      const target = clip.inPoint / 1000;
      if (player && !used.has(player) && Math.abs(player.currentTime - target) > 0.05) player.currentTime = target;
    }
  }

  private readonly tick = (now: number) => {
    if (this.playing) {
      this.advance(now);
      // Dessin calé sur chaque nouvelle image de la vidéo maître : une minuterie fixe dérive par
      // rapport aux images de la vidéo (images montrées deux fois puis sautées = saccades).
      // Sans vidéo maître (ou si le navigateur ne signale pas ses images) : 30 images par seconde.
      const paced = this.masterVideo !== null && now - this.lastVideoFrameAt < VIDEO_FRAME_TIMEOUT_MS;
      const due = paced ? this.videoFrameReady : now - this.lastFrameAt >= 1000 / this.project.fps - TIMER_SLACK_MS;
      if (this.playing && due) {
        this.videoFrameReady = false;
        this.lastFrameAt = now;
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private advance(now: number): void {
    let t = this.anchorTime + (now - this.anchorNow);

    // Le premier média en cours sert d'horloge maître quand il joue normalement (évite la dérive
    // son/image). L'horloge le rejoint en douceur : se caler d'un coup sur son temps, mis à jour
    // par à-coups dans certains navigateurs, ferait avancer l'image de façon irrégulière.
    const master = activeMediaClips(this.project, this.time)[0];
    const player = master ? this.players.get(playerKey(master.clip.mediaId, master.slot)) : undefined;
    this.setMasterVideo(player instanceof HTMLVideoElement && !player.paused ? player : null);
    if (master && player && !player.paused && !player.seeking && player.readyState >= 2) {
      const mediaTime = master.clip.start + (player.currentTime * 1000 - master.clip.inPoint) / master.clip.speed;
      const drift = mediaTime - t;
      if (Math.abs(drift) > CLOCK_TOLERANCE_MS && Math.abs(drift) < 500) {
        t += drift * CLOCK_CORRECTION;
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
    // Le temps ne recule jamais pendant la lecture (un retour en arrière fige l'image un instant).
    t = Math.max(t, this.time);
    this.time = t;
    this.syncPlaying(t);
    this.callbacks.onTime(t);
  }

  /** Suit l'arrivée des images de la vidéo maître (une boucle par vidéo, qui s'arrête avec elle). */
  private setMasterVideo(video: HTMLVideoElement | null): void {
    this.masterVideo = video;
    if (!video || !hasFrameCallback(video) || this.watchedVideos.has(video)) return;
    this.watchedVideos.add(video);
    const onFrame = () => {
      if (video === this.masterVideo) {
        this.videoFrameReady = true;
        this.lastVideoFrameAt = performance.now();
      }
      if (video.isConnected) video.requestVideoFrameCallback(onFrame);
      else this.watchedVideos.delete(video);
    };
    video.requestVideoFrameCallback(onFrame);
  }

  /** Masque de la personne pour une couche (détourage chargé à la première demande). */
  private readonly mask: MaskResolver = (layer, source) => {
    if (!segmenterReady()) {
      if (!this.segmenterRequested) {
        this.segmenterRequested = true;
        void loadSegmenter().then(this.markDirty);
      }
      return null;
    }
    const mediaId = clipMediaId(layer.clip);
    if (!mediaId) return null;
    // Un masque par lecteur, recalculé quand l'image de la vidéo change ; un seul pour une photo.
    if (source instanceof HTMLVideoElement) return this.masks.get(playerKey(mediaId, layer.slot), String(source.currentTime), source);
    return this.masks.get(mediaId, 'photo', source);
  };

  private readySource(layer: Layer, media: MediaInfo): CanvasImageSource | null {
    if (media.kind === 'image') {
      const img = this.image(media);
      return img?.complete && img.naturalWidth > 0 ? img : null;
    }
    const player = this.player(media, layer.slot);
    // En lecture, une vidéo qui se repositionne garde son image précédente : on la dessine quand
    // même, plutôt que de figer toute l'image.
    return player instanceof HTMLVideoElement && player.readyState >= 2 && (this.playing || !player.seeking) ? player : null;
  }

  private draw(): void {
    const { ctx, canvas, project } = this;
    const t = this.displayTime();
    // Une source pas encore prête (chargement, repositionnement) : on garde l'image précédente
    // plutôt qu'un flash ; les événements `seeked` / `load` redemandent un dessin.
    for (const layer of visibleLayers(project, t)) {
      const mediaId = clipMediaId(layer.clip);
      const media = mediaId ? project.media[mediaId] : undefined;
      if (media && media.kind !== 'audio' && !this.readySource(layer, media)) return;
    }
    const scale = canvas.width / project.width;
    if (this.sprites.pixelScale !== scale) {
      this.sprites.clear();
      this.sprites.pixelScale = scale;
    }
    ctx.setTransform(scale, 0, 0, canvas.height / project.height, 0, 0);
    drawFrame(ctx, project, t, (layer, media) => this.readySource(layer, media), this.sprites, this.mask);
  }
}
