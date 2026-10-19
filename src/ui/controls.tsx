import type { CSSProperties, ReactNode } from 'react';
import { useProjectStore } from '../store/projectStore';

/*
 * Regroupe toutes les modifications d'un réglage en une seule étape d'annulation :
 * un curseur, de l'appui au relâchement ; un texte ou une couleur, du focus à la sortie du champ.
 */
const begin = () => useProjectStore.getState().beginGesture();
const end = () => useProjectStore.getState().endGesture();
const pointerGesture = { onPointerDown: begin, onPointerUp: end, onPointerCancel: end };
const focusGesture = { onFocus: begin, onBlur: end };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-xs font-medium text-neutral-500">
        {label}
        <span className="text-neutral-800 tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        {...pointerGesture}
        className="h-6 w-full accent-accent"
      />
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; style?: CSSProperties }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            style={option.style}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              option.value === value ? 'border-accent bg-accent/10 text-accent' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

const SWATCHES = ['#ffffff', '#000000', '#facc15', '#ef4444', '#22c55e', '#3b82f6', '#ec4899'];

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Couleur ${color}`}
            onClick={() => onChange(color)}
            className={`h-7 w-7 rounded-full border ${value.toLowerCase() === color ? 'ring-2 ring-accent ring-offset-2' : 'border-neutral-300'}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...focusGesture}
          aria-label={`${label} : autre couleur`}
          className="h-7 w-9 cursor-pointer rounded border border-neutral-300 bg-white"
        />
      </div>
    </Field>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <textarea
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        {...focusGesture}
        className="resize-none rounded-xl border border-neutral-200 px-3 py-2 text-base focus:border-accent focus:outline-none"
      />
    </label>
  );
}

interface SecondsFieldProps {
  label: string;
  /** Valeur en millisecondes. */
  value: number;
  onCommit: (ms: number) => void;
}

/** Champ en secondes, validé à la sortie du champ ou avec Entrée. */
export function SecondsField({ label, value, onCommit }: SecondsFieldProps) {
  const commit = (input: HTMLInputElement) => {
    const seconds = Number(input.value.replace(',', '.'));
    if (Number.isFinite(seconds)) onCommit(Math.round(seconds * 1000));
    input.value = (value / 1000).toFixed(1);
  };
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <input
        key={value}
        type="text"
        inputMode="decimal"
        defaultValue={(value / 1000).toFixed(1)}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-base tabular-nums focus:border-accent focus:outline-none"
      />
    </label>
  );
}
