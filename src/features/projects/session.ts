import { create } from 'zustand';
import { migrateProject } from '../../core/migrate';
import { createProject, getMainTrack, projectDuration } from '../../core/project';
import { defaultProjectName } from '../../core/time';
import type { Project } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { clearMediaRegistry, getMediaSource, onMediaRegistered, registerMedia } from '../../store/mediaRegistry';
import {
  deleteMediaRecords,
  deleteProjectRecord,
  listProjects,
  loadProjectMedia,
  loadProjectRecord,
  renameProjectRecord,
  requestPersistentStorage,
  saveMediaRecord,
  saveProjectRecord,
  type ProjectRecord,
} from '../../store/persistence';
import { getProject, useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';

/** Délai entre la dernière modification et l'enregistrement. */
const SAVE_DELAY_MS = 800;

interface SessionState {
  status: 'loading' | 'ready';
  /** Sauvegarde indisponible (navigation privée, stockage refusé) : l'app reste utilisable. */
  storageAvailable: boolean;
  projectsOpen: boolean;
  setProjectsOpen: (open: boolean) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'loading',
  storageAvailable: true,
  projectsOpen: false,
  setProjectsOpen: (projectsOpen) => set({ projectsOpen }),
}));

let lastSaved: Project | null = null;
let timer = 0;
let saving: Promise<void> = Promise.resolve();
let errorShown = false;

function coverOf(project: Project): string | null {
  const first = getMainTrack(project).clips[0];
  return first?.type === 'media' ? (getMediaSource(first.mediaId)?.thumbnail ?? null) : null;
}

function toRecord(project: Project): ProjectRecord {
  return { id: project.id, name: project.name, updatedAt: Date.now(), duration: projectDuration(project), cover: coverOf(project), project };
}

function reportError(): void {
  if (errorShown) return;
  errorShown = true;
  notify('Impossible d’enregistrer le projet sur cet appareil (espace insuffisant ?). Exportez votre vidéo pour ne rien perdre.');
}

/** Enregistre tout de suite le projet ouvert s'il a changé. */
export function saveNow(): Promise<void> {
  window.clearTimeout(timer);
  const project = getProject();
  if (project === lastSaved || !useSessionStore.getState().storageAvailable) return saving;
  lastSaved = project;
  saving = saving
    .then(() => saveProjectRecord(toRecord(project)))
    .then(() => {
      errorShown = false;
    })
    .catch(reportError);
  return saving;
}

function scheduleSave(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
}

/** Affiche un projet relu ou nouveau : nouvel historique, éditeur remis à zéro. */
function show(project: Project): void {
  useEditorStore.getState().reset();
  useProjectStore.getState().replaceProject(project);
}

/** Ouvre un projet enregistré et ses fichiers médias. */
export async function openProject(id: string): Promise<void> {
  await saveNow();
  const record = await loadProjectRecord(id);
  if (!record) {
    notify('Ce projet est introuvable.');
    return;
  }
  const project = migrateProject(record.project, id);
  const media = await loadProjectMedia(id);
  clearMediaRegistry();
  const unused: string[] = [];
  for (const m of media) {
    if (!project.media[m.id]) unused.push(m.id);
    else registerMedia(m.id, { file: m.file, url: URL.createObjectURL(m.file), thumbnail: m.thumbnail }, true);
  }
  // Fichiers importés puis retirés (import annulé) : on libère la place.
  void deleteMediaRecords(unused).catch(() => undefined);
  const missing = Object.keys(project.media).filter((mediaId) => !getMediaSource(mediaId)).length;
  if (missing > 0) notify(`${missing} fichier(s) de ce projet n’ont pas pu être retrouvés sur l’appareil.`);
  lastSaved = project;
  show(project);
}

export async function createNewProject(): Promise<void> {
  await saveNow();
  clearMediaRegistry();
  show({ ...createProject(createId()), name: defaultProjectName(new Date()) });
  await saveNow();
}

export async function renameProject(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  if (id === getProject().id) {
    useProjectStore.getState().commit((project) => ({ ...project, name: clean }));
    await saveNow();
  } else {
    await renameProjectRecord(id, clean);
  }
}

/** Supprime définitivement un projet ; si c'est le projet ouvert, ouvre le plus récent des autres. */
export async function deleteProject(id: string): Promise<void> {
  const isCurrent = id === getProject().id;
  if (isCurrent) window.clearTimeout(timer);
  await deleteProjectRecord(id);
  if (!isCurrent) return;
  // Le projet supprimé ne doit pas être réenregistré en ouvrant le suivant.
  lastSaved = getProject();
  const [next] = await listProjects();
  if (next) await openProject(next.id);
  else await createNewProject();
}

/**
 * Démarrage : rouvre le projet le plus récent (ou en crée un) et lance la sauvegarde automatique :
 * projet enregistré peu après chaque modification et quand l'app passe en arrière-plan,
 * fichiers médias enregistrés une fois, à l'import.
 */
let started: Promise<void> | null = null;

export function startSession(): Promise<void> {
  started ??= start();
  return started;
}

async function start(): Promise<void> {
  // Le projet vide créé au chargement n'est qu'un provisoire : il ne doit jamais être enregistré.
  lastSaved = getProject();
  try {
    await requestPersistentStorage();
    const [latest] = await listProjects();
    if (latest) await openProject(latest.id);
    else await createNewProject();
  } catch {
    useSessionStore.setState({ storageAvailable: false });
    show({ ...createProject(createId()), name: defaultProjectName(new Date()) });
    notify('La sauvegarde automatique n’est pas disponible sur ce navigateur (navigation privée ?). Pensez à exporter vos vidéos.');
  }

  useProjectStore.subscribe((state) => {
    if (state.history.present !== lastSaved && useSessionStore.getState().storageAvailable) scheduleSave();
  });
  onMediaRegistered((id, source, restored) => {
    if (restored || !useSessionStore.getState().storageAvailable) return;
    const name = source.file instanceof File ? source.file.name : id;
    void saveMediaRecord({ id, projectId: getProject().id, file: source.file, name, thumbnail: source.thumbnail }).catch(reportError);
  });
  const flush = () => void saveNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  useSessionStore.setState({ status: 'ready' });
}
