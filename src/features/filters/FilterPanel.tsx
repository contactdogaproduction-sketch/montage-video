import { useEffect, useRef, useState } from 'react';
import { DEFAULT_FILTER_INTENSITY, FILTER_LABELS, FILTER_TYPES, makeFilter } from '../../core/filters';
import type { ClipFilter, FilterType, MediaClip } from '../../core/types';
import { drawFilterPreview } from '../../engine/render';
import { editMedia } from '../../store/editClip';
import { getMediaSource } from '../../store/mediaRegistry';
import { Field, Slider } from '../../ui/controls';

const THUMB_WIDTH = 54;
const THUMB_HEIGHT = 72;

/** Miniature de l'image du clip avec le filtre appliqué. */
function FilterThumb({ image, filter }: { image: HTMLImageElement | null; filter: ClipFilter | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && image) drawFilterPreview(canvas, image, image.naturalWidth, image.naturalHeight, filter);
  }, [image, filter]);
  return <canvas ref={canvasRef} width={THUMB_WIDTH * 2} height={THUMB_HEIGHT * 2} className="h-[72px] w-[54px] rounded-lg bg-neutral-200" aria-hidden="true" />;
}

/** Image de vignette du média (première image), chargée une fois. */
function useThumbnail(mediaId: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const url = getMediaSource(mediaId)?.thumbnail;
    if (!url) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
  }, [mediaId]);
  return image;
}

const CHOICES: { type: FilterType | null; label: string }[] = [
  { type: null, label: 'Aucun' },
  ...FILTER_TYPES.map((type) => ({ type, label: FILTER_LABELS[type] })),
];

/** Filtre de couleur d'une vidéo ou d'une photo, et son intensité. */
export function FilterPanel({ clip }: { clip: MediaClip }) {
  const image = useThumbnail(clip.mediaId);
  const current = clip.filter;

  return (
    <>
      <Field label="Filtre">
        <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Filtre">
          {CHOICES.map(({ type, label }) => {
            const selected = (current?.type ?? null) === type;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => editMedia(clip.id, (c) => ({ ...c, filter: makeFilter(type, c.filter?.intensity ?? DEFAULT_FILTER_INTENSITY) }))}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 text-xs ${selected ? 'bg-accent/10 font-semibold text-accent ring-2 ring-accent' : 'text-neutral-700 hover:bg-neutral-100'}`}
              >
                <FilterThumb image={image} filter={makeFilter(type)} />
                {label}
              </button>
            );
          })}
        </div>
      </Field>
      {current && (
        <Slider
          label="Intensité"
          value={Math.round(current.intensity * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v} %`}
          onChange={(v) => editMedia(clip.id, (c) => ({ ...c, filter: c.filter ? makeFilter(c.filter.type, v / 100) : null }))}
        />
      )}
    </>
  );
}
