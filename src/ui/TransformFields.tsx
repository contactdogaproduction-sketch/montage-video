import type { Transform } from '../core/types';
import { Field, Slider } from './controls';

interface TransformFieldsProps {
  transform: Transform;
  onChange: (update: (transform: Transform) => Transform) => void;
  maxScale?: number;
}

const POSITIONS = [
  { label: 'Haut', y: 0.2 },
  { label: 'Centre', y: 0.5 },
  { label: 'Bas', y: 0.8 },
];

/** Taille, rotation et position rapide d'un élément visuel. */
export function TransformFields({ transform, onChange, maxScale = 3 }: TransformFieldsProps) {
  return (
    <>
      <Slider
        label="Taille"
        value={transform.scale}
        min={0.1}
        max={maxScale}
        step={0.01}
        format={(v) => `${Math.round(v * 100)} %`}
        onChange={(scale) => onChange((t) => ({ ...t, scale }))}
      />
      <Slider
        label="Rotation"
        value={transform.rotation}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        onChange={(rotation) => onChange((t) => ({ ...t, rotation }))}
      />
      <Field label="Position (ou glissez l’élément dans l’aperçu)">
        <div className="flex gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange((t) => ({ ...t, x: 0.5, y: p.y }))}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}
