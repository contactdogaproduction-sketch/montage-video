/** Temps et durées en millisecondes (entiers). */
export type Ms = number;

export type MediaKind = 'video' | 'image';

/** Métadonnées d'un média importé. Le fichier lui-même vit hors du projet (registre des médias). */
export interface MediaInfo {
  id: string;
  kind: MediaKind;
  name: string;
  /** Durée de la source ; `null` pour une image (durée libre). */
  duration: Ms | null;
  width: number;
  height: number;
}

export interface Clip {
  id: string;
  mediaId: string;
  /** Position du début du clip sur la timeline. */
  start: Ms;
  /** Point d'entrée dans la source. */
  inPoint: Ms;
  /** Durée du clip sur la timeline. */
  duration: Ms;
}

/** `main` : piste vidéo principale, clips toujours accolés depuis 0 (sans trou). */
export type TrackKind = 'main';

export interface Track {
  id: string;
  kind: TrackKind;
  clips: Clip[];
}

export interface Project {
  id: string;
  name: string;
  /** Dimensions de rendu (export et repère de l'aperçu). */
  width: number;
  height: number;
  fps: number;
  media: Record<string, MediaInfo>;
  tracks: Track[];
}
