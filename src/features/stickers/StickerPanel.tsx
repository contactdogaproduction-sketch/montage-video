import type { StickerClip } from '../../core/types';
import { editTransform } from '../../store/editClip';
import { TransformFields } from '../../ui/TransformFields';
import { ClipTiming } from '../timeline/ClipTiming';

export function StickerPanel({ clip }: { clip: StickerClip }) {
  return (
    <>
      <TransformFields transform={clip.transform} onChange={(update) => editTransform(clip.id, update)} />
      <ClipTiming clip={clip} />
    </>
  );
}
