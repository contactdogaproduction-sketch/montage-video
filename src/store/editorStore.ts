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
  select: (clipId: string | null) => void;
  setPlayhead: (t: Ms) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (pxPerSecond: number) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedClipId: null,
  playhead: 0,
  playing: false,
  pxPerSecond: DEFAULT_ZOOM,
  select: (selectedClipId) => set({ selectedClipId }),
  setPlayhead: (t) => set({ playhead: Math.max(0, Math.round(t)) }),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pxPerSecond) => set({ pxPerSecond: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pxPerSecond)) }),
}));
