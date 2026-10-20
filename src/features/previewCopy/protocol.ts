export interface CopyRequest {
  /** Identifiant de la tâche (un média). */
  id: string;
  file: Blob;
}

export type CopyResponse =
  | { type: 'progress'; id: string; progress: number }
  /** Copie terminée (MP4 H.264 720p, 30 images/s). */
  | { type: 'done'; id: string; data: ArrayBuffer }
  /** Pas de copie : vidéo déjà légère, fichier sans image ou non lisible ici (l'original sert à l'aperçu). */
  | { type: 'skipped'; id: string }
  /** Le navigateur ne sait pas convertir les vidéos (WebCodecs absent). */
  | { type: 'unsupported'; id: string };
