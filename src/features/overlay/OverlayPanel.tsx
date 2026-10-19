import type { MediaClip } from '../../core/types';
import { TransformSection } from '../keyframes/KeyframePanel';

/** Placement d'une vidéo ou d'une photo (principale ou incrustation) et ses keyframes. */
export function OverlayPanel({ clip, overlay }: { clip: MediaClip; overlay: boolean }) {
  return <TransformSection clip={clip} maxScale={overlay ? 2 : 3} />;
}
