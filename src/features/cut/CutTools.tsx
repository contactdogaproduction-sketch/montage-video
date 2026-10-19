import { useEditorStore } from '../../store/editorStore';
import { useProject } from '../../store/projectStore';
import { CopyIcon, ScissorsIcon, TrashIcon } from '../../ui/icons';
import { ToolButton } from '../../ui/ToolButton';
import { deleteSelected, duplicateSelected, selectedClip, splitAtPlayhead, splittableClipAt } from './actions';

export function CutTools() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const canSplit = splittableClipAt(project, selectedClipId, playhead) !== undefined;
  const hasSelection = selectedClip(project, selectedClipId) !== undefined;

  return (
    <>
      <ToolButton icon={<ScissorsIcon />} label="Couper" onClick={splitAtPlayhead} disabled={!canSplit} title="Couper au curseur (S)" />
      <ToolButton icon={<CopyIcon />} label="Dupliquer" onClick={duplicateSelected} disabled={!hasSelection} title="Dupliquer le clip" />
      <ToolButton icon={<TrashIcon />} label="Supprimer" onClick={deleteSelected} disabled={!hasSelection} title="Supprimer le clip (Suppr)" />
    </>
  );
}
