/**
 * Fichiers des médias importés, indexés par identifiant de média.
 * Hors historique : annuler un import retire le média du projet mais garde le fichier,
 * pour que « Rétablir » le retrouve.
 */
export interface MediaSource {
  file: File;
  url: string;
  thumbnail: string | null;
}

const registry = new Map<string, MediaSource>();

export function registerMedia(id: string, source: MediaSource): void {
  registry.set(id, source);
}

export function getMediaSource(id: string): MediaSource | undefined {
  return registry.get(id);
}
