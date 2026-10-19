import type { CSSProperties } from 'react';
import type { Clip, Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';
import { useTrimHandle } from '../cut/useTrimHandle';
import { speedLabel } from '../speed/SpeedPanel';
import { useClipDrag } from './useClipDrag';

interface ClipViewProps {
  project: Project;
  clip: Clip;
  left: number;
  width: number;
  /** Zoom de la timeline (position des keyframes). */
  pxPerSecond: number;
  selected: boolean;
  /** Clip en cours de déplacement : affiché en transparence à sa place d'origine. */
  dragging: boolean;
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
      <span className="h-1/2 w-0.5 rounded bg-white" />
    </div>
  );
}

/** Apparence d'un clip selon son type : miniatures, texte, emoji ou nom du fichier audio. */
export function clipAppearance(project: Project, clip: Clip): { label: string; style: CSSProperties; className: string } {
  switch (clip.type) {
    case 'media': {
      const media = project.media[clip.mediaId];
      if (media?.kind === 'audio') return { label: `♪ ${media.name}`, style: {}, className: 'bg-emerald-100 text-emerald-900' };
      const thumbnail = media ? getMediaSource(media.id)?.thumbnail : null;
      return {
        label: '',
        className: 'bg-neutral-300',
        style: thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' } : {},
      };
    }
    case 'text':
      return { label: `T  ${clip.text.replace(/\n/g, ' ')}`, style: {}, className: 'bg-amber-100 text-amber-950' };
    case 'sticker': {
      if (clip.source.kind === 'emoji') return { label: clip.source.emoji, style: {}, className: 'bg-pink-100 text-pink-950' };
      const thumbnail = getMediaSource(clip.source.mediaId)?.thumbnail;
      return {
        label: '',
        className: 'bg-pink-100',
        style: thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' } : {},
      };
    }
  }
}

export function ClipView({ project, clip, left, width, pxPerSecond, selected, dragging, onSelect }: ClipViewProps) {
  const drag = useClipDrag(clip.id);
  const look = clipAppearance(project, clip);

  return (
    <div
      {...drag}
      onPointerDown={(e) => {
        e.stopPropagation();
        drag.onPointerDown(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`absolute inset-y-1 overflow-hidden rounded-lg select-none [-webkit-touch-callout:none] ${look.className} ${
        selected ? 'ring-2 ring-accent' : 'ring-1 ring-white'
      } ${dragging ? 'opacity-40' : ''}`}
      style={{ left, width: Math.max(2, width), ...look.style }}
    >
      {look.label && (
        <span className="pointer-events-none absolute inset-y-0 left-5 right-5 flex items-center truncate text-xs font-medium whitespace-nowrap">
          {look.label}
        </span>
      )}
      <span className="pointer-events-none absolute right-5 bottom-0.5 rounded bg-black/55 px-1 text-[10px] font-medium text-white">
        {clip.type === 'media' && clip.speed !== 1 && `${speedLabel(clip.speed)} · `}
        {(clip.duration / 1000).toFixed(1)} s
      </span>
      {selected && (
        <>
          {clip.keyframes.map((k) => (
            <span
              key={k.time}
              aria-hidden="true"
              className="pointer-events-none absolute top-1 z-10 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white ring-1 ring-accent"
              style={{ left: (k.time / 1000) * pxPerSecond }}
            />
          ))}
          <TrimHandle clipId={clip.id} edge="start" />
          <TrimHandle clipId={clip.id} edge="end" />
        </>
      )}
    </div>
  );
}
