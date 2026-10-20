/**
 * Sauvegarde sur l'appareil (IndexedDB) : projets et fichiers médias.
 * Rien ne quitte l'appareil.
 */
import type { Ms, Project } from '../core/types';

const DB_NAME = 'montage-video';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const MEDIA = 'media';

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  duration: Ms;
  /** Miniature du premier clip, pour la liste des projets. */
  cover: string | null;
  project: Project;
}

export type ProjectSummary = Omit<ProjectRecord, 'project'>;

export interface MediaRecord {
  id: string;
  projectId: string;
  file: Blob;
  name: string;
  thumbnail: string | null;
  /** Copie allégée pour l'aperçu (vidéos lourdes), créée après l'import. */
  preview?: Blob;
}

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(MEDIA)) {
        db.createObjectStore(MEDIA, { keyPath: 'id' }).createIndex('projectId', 'projectId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage indisponible.'));
  });
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erreur de stockage.'));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Erreur de stockage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Enregistrement interrompu (espace insuffisant ?).'));
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDb();
  const records = await done(db.transaction(PROJECTS).objectStore(PROJECTS).getAll() as IDBRequest<ProjectRecord[]>);
  return records
    .map(({ project: _project, ...summary }) => summary)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProjectRecord(id: string): Promise<ProjectRecord | undefined> {
  const db = await openDb();
  return done(db.transaction(PROJECTS).objectStore(PROJECTS).get(id) as IDBRequest<ProjectRecord | undefined>);
}

export async function saveProjectRecord(record: ProjectRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PROJECTS, 'readwrite');
  tx.objectStore(PROJECTS).put(record);
  await completed(tx);
}

export async function renameProjectRecord(id: string, name: string): Promise<void> {
  const record = await loadProjectRecord(id);
  if (!record) return;
  await saveProjectRecord({ ...record, name, updatedAt: Date.now(), project: { ...record.project, name } });
}

/** Supprime le projet et tous ses fichiers médias. */
export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROJECTS, MEDIA], 'readwrite');
  tx.objectStore(PROJECTS).delete(id);
  // Suppression dans les rappels de la transaction (elle reste active tant qu'il y a des requêtes).
  const cursorRequest = tx.objectStore(MEDIA).index('projectId').openCursor(IDBKeyRange.only(id));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await completed(tx);
}

export async function saveMediaRecord(record: MediaRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEDIA, 'readwrite');
  tx.objectStore(MEDIA).put(record);
  await completed(tx);
}

/** Ajoute la copie allégée au fichier déjà enregistré, ou la retire (`null`). */
export async function saveMediaPreview(id: string, preview: Blob | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEDIA, 'readwrite');
  const store = tx.objectStore(MEDIA);
  const request = store.get(id) as IDBRequest<MediaRecord | undefined>;
  request.onsuccess = () => {
    // Rien à retirer : on ne réécrit pas le fichier (coûteux pour une vidéo).
    if (!request.result || (!preview && !request.result.preview)) return;
    const { preview: _old, ...record } = request.result;
    store.put(preview ? { ...record, preview } : record);
  };
  await completed(tx);
}

export async function loadProjectMedia(projectId: string): Promise<MediaRecord[]> {
  const db = await openDb();
  return done(db.transaction(MEDIA).objectStore(MEDIA).index('projectId').getAll(projectId) as IDBRequest<MediaRecord[]>);
}

export async function deleteMediaRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(MEDIA, 'readwrite');
  for (const id of ids) tx.objectStore(MEDIA).delete(id);
  await completed(tx);
}

/**
 * Demande au navigateur de ne pas effacer les données de l'app quand l'espace manque
 * (accordé automatiquement aux apps installées sur l'écran d'accueil).
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
  } catch {
    // Non pris en charge : la sauvegarde fonctionne quand même.
  }
}

/** Espace utilisé par l'app, en octets, s'il est connu. */
export async function storageUsage(): Promise<number | null> {
  try {
    return (await navigator.storage?.estimate?.())?.usage ?? null;
  } catch {
    return null;
  }
}
