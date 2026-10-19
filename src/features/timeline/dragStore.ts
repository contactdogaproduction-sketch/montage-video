import { create } from 'zustand';
import type { Ms } from '../../core/types';

export interface ClipDrag {
  clipId: string;
  /** Distance entre le pointeur et le bord gauche du clip au début du glisser (px). */
  offsetX: number;
  clientX: number;
  clientY: number;
}

interface DragState {
  drag: ClipDrag | null;
  /** Conversion position écran → temps, fournie par la timeline affichée. */
  timeAtClientX: (clientX: number) => Ms;
  setDrag: (drag: ClipDrag | null) => void;
  setTimeAtClientX: (fn: (clientX: number) => Ms) => void;
}

/** État du glisser-déposer en cours dans la timeline (hors historique). */
export const useDragStore = create<DragState>()((set) => ({
  drag: null,
  timeAtClientX: () => 0,
  setDrag: (drag) => set({ drag }),
  setTimeAtClientX: (timeAtClientX) => set({ timeAtClientX }),
}));
