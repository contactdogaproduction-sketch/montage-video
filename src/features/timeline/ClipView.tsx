import type { PointerEvent } from 'react';
import type { Clip, MediaInfo } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { useTrimHandle } from '../cut/useTrimHandle';

interface ClipViewProps {
  clip: Clip;
  media: MediaInfo;
  left: number;
  width: number;
  selected: boolean;
  onSelect: (clipId: string) => void;
}

function TrimHandle({ clipId, edge }: { clipId: string; edge: 'start' | 'end' }) {
  const handlers = useTrimHandle(clipId, edge);
  return (
    <div
      {...handlers}
      aria-label={edge === 'start' ? 'Ajuster le début du clip' : 'Ajuster la fin du clip'}
      className={`absolute inset-y-0 z-10 flex w-4 cursor-ew-resize touch-none items-center justify-center bg-accent ${
        edge === 'start' ? 'left-0 rounded-l-lg' : 'right-0 rounded-r-lg'
      }`}
    >
      <span className="h-6 w-0.5 rounded bg-white" />
    </div>
  );
}

export function ClipView({ clip, media, left, width, selected, onSelect }: ClipViewProps) {
  const thumbnail = getMediaSource(media.id)?.thumbnail;
  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <div
      className={`absolute inset-y-1 overflow-hidden rounded-lg bg-neutral-300 ${
        selected ? 'ring-2 ring-accent' : 'ring-1 ring-white'
      }`}
      style={{
        left,
        width: Math.max(2, width),
        backgroundImage: thumbnail ? `url(${thumbnail})` : undefined,
        backgroundSize: 'auto 100%',
        backgroundRepeat: 'repeat-x',
      }}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
      }}
      title={media.name}
    >
      <span className="absolute bottom-1 left-5 rounded bg-black/55 px-1.5 text-[10px] font-medium text-white">
        {(clip.duration / 1000).toFixed(1)} s
      </span>
      {selected && (
        <>
          <TrimHandle clipId={clip.id} edge="start" />
          <TrimHandle clipId={clip.id} edge="end" />
        </>
      )}
    </div>
  );
}
