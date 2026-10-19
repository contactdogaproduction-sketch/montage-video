import type { MediaClip } from '../../core/types';
import { editTransform } from '../../store/editClip';
import { TransformFields } from '../../ui/TransformFields';

/** Taille, rotation et position d'une incrustation. */
export function OverlayPanel({ clip }: { clip: MediaClip }) {
  return <TransformFields transform={clip.transform} onChange={(update) => editTransform(clip.id, update)} maxScale={2} />;
}
