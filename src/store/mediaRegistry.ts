/**
 * Fichiers des médias importés, indexés par identifiant de média.
 * Hors historique : annuler un import retire le média du projet mais garde le fichier,
 * pour que « Rétablir » le retrouve.
 */
export interface MediaSource {
  file: Blob;
  url: string;
  thumbnail: string | null;
}

/** `restored` : fichier relu depuis la sauvegarde de l'appareil (inutile de l'enregistrer à nouveau). */
type RegisterListener = (id: string, source: MediaSource, restored: boolean) => void;

const registry = new Map<string, MediaSource>();
const listeners = new Set<RegisterListener>();

export function registerMedia(id: string, source: MediaSource, restored = false): void {
  registry.set(id, source);
  for (const listener of listeners) listener(id, source, restored);
}

export function getMediaSource(id: string): MediaSource | undefined {
  return registry.get(id);
}

/** Libère les fichiers en mémoire (ouverture d'un autre projet). */
export function clearMediaRegistry(): void {
  for (const source of registry.values()) URL.revokeObjectURL(source.url);
  registry.clear();
}

/** Être prévenu de chaque média ajouté (sauvegarde automatique). */
export function onMediaRegistered(listener: RegisterListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
