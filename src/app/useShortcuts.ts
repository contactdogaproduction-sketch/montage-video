import { useEffect } from 'react';
import { togglePlayback } from '../engine/preview/playback';
import { deleteSelected, splitAtPlayhead } from '../features/cut/actions';
import { useProjectStore } from '../store/projectStore';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Raccourcis clavier : Espace, S, Suppr, Ctrl+Z, Ctrl+Maj+Z (et Ctrl+Y). */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target) || document.querySelector('[aria-modal="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useProjectStore.getState().redo();
        else useProjectStore.getState().undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        useProjectStore.getState().redo();
      } else if (mod || e.altKey) {
        return;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) togglePlayback();
      } else if (key === 's') {
        e.preventDefault();
        splitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
    };
    // Empêche Espace d'activer aussi le bouton qui a le focus.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditable(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
