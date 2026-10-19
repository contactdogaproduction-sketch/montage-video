import { AudioButton } from '../features/audio/AudioButton';
import { FormatButton } from '../features/format/FormatButton';
import { CutTools } from '../features/cut/CutTools';
import { FreezeButton } from '../features/freeze/FreezeButton';
import { ImportButton } from '../features/import/ImportButton';
import { OverlayButton } from '../features/overlay/OverlayButton';
import { StickerButton } from '../features/stickers/StickerButton';
import { SubtitlesButton } from '../features/subtitles/SubtitlesButton';
import { VoiceOverButton } from '../features/voiceover/VoiceOverButton';
import { AddTextButton } from '../features/text/AddTextButton';
import { useEditorStore } from '../store/editorStore';
import { useProject } from '../store/projectStore';
import { SlidersIcon } from '../ui/icons';
import { ToolButton } from '../ui/ToolButton';
import { hasPanel } from './Inspector';

const Separator = () => <span className="mx-1 w-px shrink-0 self-stretch bg-neutral-200" aria-hidden="true" />;

/**
 * Barre d'outils. Quand un clip est sélectionné, ses outils passent en tête (accessibles à une main) :
 * « Réglages » (sur téléphone), puis couper, dupliquer, supprimer.
 */
export function Toolbar() {
  const project = useProject();
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const hasSelection = selectedClipId !== null;
  const addTools = (
    <>
      <ImportButton />
      <OverlayButton />
      <AddTextButton />
      <StickerButton />
      <AudioButton />
      <SubtitlesButton />
      <VoiceOverButton />
      <FormatButton />
    </>
  );
  const clipTools = (
    <>
      {hasPanel(project, selectedClipId) && (
        <span className="contents lg:hidden">
          <ToolButton icon={<SlidersIcon />} label="Réglages" onClick={() => useEditorStore.getState().setInspectorOpen(true)} title="Réglages de l’élément sélectionné" />
        </span>
      )}
      <CutTools />
      <FreezeButton />
    </>
  );
  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-neutral-200 bg-white px-2 py-1 sm:justify-center" aria-label="Outils">
      {hasSelection ? clipTools : addTools}
      <Separator />
      {hasSelection ? addTools : clipTools}
    </nav>
  );
}
