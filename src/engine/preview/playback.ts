import { projectDuration } from '../../core/project';
import { useEditorStore } from '../../store/editorStore';
import { getProject } from '../../store/projectStore';
import type { PreviewPlayer } from './PreviewPlayer';

let player: PreviewPlayer | null = null;

export function attachPlayer(instance: PreviewPlayer | null): void {
  player = instance;
}

/**
 * Lecture / pause. Appelée directement depuis le geste (clic, touche Espace) pour que
 * le navigateur autorise la lecture du son.
 */
export function togglePlayback(): void {
  const editor = useEditorStore.getState();
  if (!player) return;
  if (player.isPlaying) {
    player.pause();
    editor.setPlaying(false);
    return;
  }
  if (projectDuration(getProject()) === 0) return;
  player.seek(editor.playhead);
  player.play();
  editor.setPlaying(true);
}
