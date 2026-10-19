import type { StickerClip } from '../../core/types';
import { TransformSection } from '../keyframes/KeyframePanel';
import { ClipTiming } from '../timeline/ClipTiming';

export function StickerPanel({ clip }: { clip: StickerClip }) {
  return (
    <>
      <TransformSection clip={clip} />
      <ClipTiming clip={clip} />
    </>
  );
}
