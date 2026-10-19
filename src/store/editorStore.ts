import { create } from 'zustand';
import type { Ms } from '../core/types';

export const MIN_ZOOM = 10;
export const MAX_ZOOM = 600;
export const DEFAULT_ZOOM = 80;

/** État de l'éditeur hors historique : sélection, lecture, zoom. */
interface EditorState {
  selectedClipId: string | null;
  playhead: Ms;
  playing: boolean;
  /** Zoom de la timeline, en pixels par seconde. */
  pxPerSecond: number;
  /** Panneau de réglages ouvert (sur téléphone ; toujours visible sur grand écran quand un élément est sélectionné). */
  inspectorOpen: boolean;
  /** Transition sélectionnée : identifiant du clip principal qui la précède. */
  selectedTransitionId: string | null;
  select: (clipId: string | null) => void;
  /** Sélectionne la transition qui suit ce clip et ouvre ses réglages. */
  selectTransition: (clipId: string) => void;
  setInspectorOpen: (open: boolean) => void;
  setPlayhead: (t: Ms) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (pxPerSecond: number) => void;
  /** Remet l'éditeur à zéro (ouverture d'un autre projet). */
  reset: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedClipId: null,
  playhead: 0,
  playing: false,
  pxPerSecond: DEFAULT_ZOOM,
  inspectorOpen: false,
  selectedTransitionId: null,
  select: (selectedClipId) =>
    set(selectedClipId === null ? { selectedClipId, selectedTransitionId: null, inspectorOpen: false } : { selectedClipId, selectedTransitionId: null }),
  selectTransition: (clipId) => set({ selectedClipId: null, selectedTransitionId: clipId, inspectorOpen: true }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setPlayhead: (t) => set({ playhead: Math.max(0, Math.round(t)) }),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pxPerSecond) => set({ pxPerSecond: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pxPerSecond)) }),
  reset: () => set({ selectedClipId: null, selectedTransitionId: null, inspectorOpen: false, playhead: 0, playing: false }),
}));
