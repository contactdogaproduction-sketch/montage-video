import { useState } from 'react';
import { sourceTimeAt } from '../../core/clip';
import { freezableClip, insertFreezeFrame } from '../../core/freeze';
import { addMedia } from '../../core/project';
import { formatTime } from '../../core/time';
import { captureVideoFrame } from '../../engine/mediaElement';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { getMediaSource, registerMedia } from '../../store/mediaRegistry';
import { getProject, useProject, useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';
import { ToolButton } from '../../ui/ToolButton';
import { readMedia } from '../import/readMedia';

const FreezeIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 8v8M9 9.5l6 5M15 9.5l-6 5" />
  </svg>
);

/** Fige l'image de la vidéo au curseur : la vidéo est coupée et une image fixe de 2 s est insérée. */
async function freezeAtPlayhead(): Promise<void> {
  const editor = useEditorStore.getState();
  editor.setPlaying(false);
  const t = editor.playhead;
  const project = getProject();
  const clip = freezableClip(project, editor.selectedClipId, t);
  const source = clip ? getMediaSource(clip.mediaId) : undefined;
  if (!clip || !source) return;

  const blob = await captureVideoFrame(source.url, sourceTimeAt(clip, t) / 1000);
  const id = createId();
  const file = new File([blob], `Image figée ${formatTime(t)}.jpg`, { type: 'image/jpeg' });
  const { info, url, thumbnail } = await readMedia(file, id);
  registerMedia(id, { file, url, thumbnail });

  const freezeId = createId();
  const rightPart = createId();
  useProjectStore.getState().commit((p) => insertFreezeFrame(addMedia(p, [info]), clip.id, t, info, { freeze: freezeId, rightPart }) ?? p);
  editor.select(freezeId);
}

/** Bouton « Figer » : actif quand le curseur est sur une vidéo de la piste principale. */
export function FreezeButton() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const [busy, setBusy] = useState(false);
  const available = freezableClip(project, selectedClipId, playhead) !== undefined;

  const run = async () => {
    setBusy(true);
    try {
      await freezeAtPlayhead();
    } catch {
      notify('Impossible de figer l’image à cet endroit de la vidéo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolButton
      icon={<FreezeIcon />}
      label={busy ? 'Capture…' : 'Figer'}
      onClick={() => void run()}
      disabled={!available || busy}
      title="Figer l’image de la vidéo au curseur (image fixe de 2 s)"
    />
  );
}
