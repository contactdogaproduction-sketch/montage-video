/**
 * Fichiers des médias importés, indexés par identifiant de média.
 * Hors historique : annuler un import retire le média du projet mais garde le fichier,
 * pour que « Rétablir » le retrouve.
 */
export interface MediaSource {
  file: Blob;
  url: string;
  thumbnail: string | null;
  /** Copie allégée de la vidéo, pour l'aperçu seulement (l'export utilise toujours `file`). */
  preview?: { file: Blob; url: string };
}

/** `restored` : fichier relu depuis la sauvegarde de l'appareil (inutile de l'enregistrer à nouveau). */
type RegisterListener = (id: string, source: MediaSource, restored: boolean) => void;

const registry = new Map<string, MediaSource>();
const listeners = new Set<RegisterListener>();
/** `preview` : la nouvelle copie, ou `null` quand elle est supprimée. */
type PreviewListener = (id: string, preview: Blob | null) => void;
const previewListeners = new Set<PreviewListener>();

export function registerMedia(id: string, source: MediaSource, restored = false): void {
  registry.set(id, source);
  for (const listener of listeners) listener(id, source, restored);
}

export function getMediaSource(id: string): MediaSource | undefined {
  return registry.get(id);
}

/** Libère les fichiers en mémoire (ouverture d'un autre projet). */
export function clearMediaRegistry(): void {
  for (const source of registry.values()) {
    URL.revokeObjectURL(source.url);
    if (source.preview) URL.revokeObjectURL(source.preview.url);
  }
  registry.clear();
}

/** Être prévenu de chaque média ajouté (sauvegarde automatique). */
export function onMediaRegistered(listener: RegisterListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ajoute la copie allégée d'un média, si son fichier est toujours celui-là (projet non changé entre-temps). */
export function setMediaPreview(id: string, file: Blob, preview: Blob): boolean {
  const source = registry.get(id);
  // Une copie déjà en place n'est jamais remplacée (un lecteur peut être en train de la lire).
  if (!source || source.file !== file || source.preview) return false;
  registry.set(id, { ...source, preview: { file: preview, url: URL.createObjectURL(preview) } });
  for (const listener of previewListeners) listener(id, preview);
  return true;
}

/**
 * Supprime les copies allégées des médias ouverts (après l'export : place libérée sur l'appareil).
 * Tous les médias sont signalés, pour abandonner aussi les copies encore en préparation.
 * Renvoie la taille libérée, en octets.
 */
export function removeMediaPreviews(): number {
  let freed = 0;
  for (const [id, source] of registry) {
    const { preview, ...rest } = source;
    if (preview) {
      freed += preview.file.size;
      registry.set(id, rest);
    }
    for (const listener of previewListeners) listener(id, null);
    // Après les écouteurs : l'aperçu a relâché la copie avant que son adresse soit libérée.
    if (preview) URL.revokeObjectURL(preview.url);
  }
  return freed;
}

/** Être prévenu de chaque copie allégée prête ou supprimée (aperçu, sauvegarde). */
export function onMediaPreview(listener: PreviewListener): () => void {
  previewListeners.add(listener);
  return () => previewListeners.delete(listener);
}
