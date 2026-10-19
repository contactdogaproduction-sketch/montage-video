/** Temps et durées en millisecondes (entiers). */
export type Ms = number;

export type MediaKind = 'video' | 'image' | 'audio';

/** Métadonnées d'un média importé. Le fichier lui-même vit hors du projet (registre des médias). */
export interface MediaInfo {
  id: string;
  kind: MediaKind;
  name: string;
  /** Durée de la source ; `null` pour une image (durée libre). */
  duration: Ms | null;
  /** Dimensions de l'image (0 pour un fichier audio). */
  width: number;
  height: number;
}

/**
 * Placement d'un élément visuel dans le cadre.
 * `x`, `y` : centre de l'élément, en fraction du cadre (0 à 1) ;
 * `scale` : 1 = taille de base de l'élément ; `rotation` en degrés ; `opacity` de 0 à 1.
 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

interface ClipBase {
  id: string;
  /** Position du début du clip sur la timeline. */
  start: Ms;
  /** Durée du clip sur la timeline. */
  duration: Ms;
}

/** Clip issu d'un média importé : vidéo, photo ou audio. */
export interface MediaClip extends ClipBase {
  type: 'media';
  mediaId: string;
  /** Point d'entrée dans la source. */
  inPoint: Ms;
  /** Volume du clip, de 0 à 2 (200 %). */
  volume: number;
  fadeIn: Ms;
  fadeOut: Ms;
  transform: Transform;
}

export type FontId = 'montserrat' | 'bebas' | 'pacifico';

export interface TextStyle {
  font: FontId;
  /** Taille du texte en pixels du cadre (1080 de large). */
  size: number;
  color: string;
  strokeColor: string;
  /** Épaisseur du contour en pixels du cadre (0 = sans contour). */
  strokeWidth: number;
}

export type TextAnimation = 'none' | 'fade' | 'slide' | 'zoom';

export interface TextClip extends ClipBase {
  type: 'text';
  text: string;
  style: TextStyle;
  transform: Transform;
  animationIn: TextAnimation;
  animationOut: TextAnimation;
}

export type StickerSource = { kind: 'emoji'; emoji: string } | { kind: 'image'; mediaId: string };

export interface StickerClip extends ClipBase {
  type: 'sticker';
  source: StickerSource;
  transform: Transform;
}

export type Clip = MediaClip | TextClip | StickerClip;

/**
 * `main` : piste vidéo principale, clips toujours accolés depuis 0 (sans trou).
 * Les autres pistes placent leurs clips librement, sans chevauchement.
 */
export type TrackKind = 'main' | 'overlay' | 'text' | 'sticker' | 'audio';

export interface Track {
  id: string;
  kind: TrackKind;
  clips: Clip[];
  /** Volume de la piste, de 0 à 2 (200 %). */
  volume: number;
}

export interface Project {
  id: string;
  name: string;
  /** Dimensions de rendu (export et repère de l'aperçu). */
  width: number;
  height: number;
  fps: number;
  media: Record<string, MediaInfo>;
  /** Pistes de la plus basse (piste principale, dessinée en premier) à la plus haute. */
  tracks: Track[];
}
