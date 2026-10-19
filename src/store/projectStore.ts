import { create } from 'zustand';
import { createProject } from '../core/project';
import type { Project } from '../core/types';
import { createId } from './createId';
import { createHistory, pushState, redo, undo, type History } from './history';

interface ProjectState {
  history: History<Project>;
  /** État du projet au début du geste en cours (glisser, trim), sinon `null`. */
  gestureBase: Project | null;
  /** Modification ponctuelle : une entrée d'historique. */
  commit: (update: (project: Project) => Project) => void;
  /** Début d'un geste continu : toutes ses mises à jour formeront une seule entrée d'historique. */
  beginGesture: () => void;
  /** Mise à jour pendant le geste, calculée à partir de l'état du début du geste. */
  updateGesture: (update: (base: Project) => Project) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  history: createHistory(createProject(createId())),
  gestureBase: null,

  commit: (update) => {
    if (get().gestureBase) return;
    const { history } = get();
    set({ history: pushState(history, update(history.present)) });
  },

  beginGesture: () => {
    if (get().gestureBase) return;
    set({ gestureBase: get().history.present });
  },

  updateGesture: (update) => {
    const { gestureBase, history } = get();
    if (!gestureBase) return;
    set({ history: { ...history, present: update(gestureBase) } });
  },

  endGesture: () => {
    const { gestureBase, history } = get();
    if (!gestureBase) return;
    // Une seule entrée : de l'état du début du geste à l'état final.
    set({ gestureBase: null, history: pushState({ ...history, present: gestureBase }, history.present) });
  },

  undo: () => {
    if (get().gestureBase) return;
    set({ history: undo(get().history) });
  },

  redo: () => {
    if (get().gestureBase) return;
    set({ history: redo(get().history) });
  },
}));

export const useProject = (): Project => useProjectStore((s) => s.history.present);
export const getProject = (): Project => useProjectStore.getState().history.present;
