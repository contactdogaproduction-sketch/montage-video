import type { FitMode, MediaClip } from '../../core/types';
import { editMedia } from '../../store/editClip';
import { Segmented } from '../../ui/controls';
import { TransformSection } from '../keyframes/KeyframePanel';

const FITS: { value: FitMode; label: string }[] = [
  { value: 'contain', label: 'Ajuster (image entière)' },
  { value: 'cover', label: 'Remplir (recadré)' },
];

/** Cadrage et placement d'une vidéo ou d'une photo (principale ou incrustation), et ses keyframes. */
export function OverlayPanel({ clip, overlay }: { clip: MediaClip; overlay: boolean }) {
  return (
    <>
      <Segmented label="Cadrage" value={clip.fit} options={FITS} onChange={(fit) => editMedia(clip.id, (c) => ({ ...c, fit }))} />
      <TransformSection clip={clip} maxScale={overlay ? 2 : 3} />
    </>
  );
}
