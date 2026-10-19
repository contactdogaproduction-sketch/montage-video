import { createTextClip } from '../../core/clip';
import { placeClip } from '../../core/project';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore } from '../../store/projectStore';
import { TextIcon } from '../../ui/icons';
import { ToolButton } from '../../ui/ToolButton';

/** Ajoute un texte au curseur et le sélectionne pour le modifier. */
export function addText(): void {
  const editor = useEditorStore.getState();
  const clip = createTextClip(createId(), Math.round(editor.playhead));
  useProjectStore.getState().commit((project) => placeClip(project, clip, createId()));
  editor.select(clip.id);
  editor.setInspectorOpen(true);
}

export function AddTextButton() {
  return <ToolButton icon={<TextIcon />} label="Texte" onClick={addText} title="Ajouter un texte au curseur" />;
}
