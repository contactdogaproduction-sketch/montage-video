import { DEFAULT_TRANSITION, MIN_TRANSITION, TRANSITION_LABELS, TRANSITION_TYPES, maxTransitionDuration } from '../../core/transition';
import type { Clip, MediaClip, TransitionType } from '../../core/types';
import { editMedia } from '../../store/editClip';
import { Segmented, Slider } from '../../ui/controls';

type Choice = TransitionType | 'none';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'none', label: 'Aucune' },
  ...TRANSITION_TYPES.map((type) => ({ value: type as Choice, label: TRANSITION_LABELS[type] })),
];

/** Type et durée de la transition entre `from` et le clip suivant de la piste principale. */
export function TransitionPanel({ from, to }: { from: MediaClip; to: Clip }) {
  const max = maxTransitionDuration(from, to);
  const current = from.transition;

  const choose = (choice: Choice) =>
    editMedia(from.id, (c) => ({
      ...c,
      transition: choice === 'none' ? null : { type: choice, duration: Math.min(max, c.transition?.duration ?? DEFAULT_TRANSITION) },
    }));

  return (
    <>
      <Segmented label="Effet" value={current?.type ?? 'none'} options={CHOICES} onChange={choose} />
      {current && max >= MIN_TRANSITION && (
        <Slider
          label="Durée"
          value={Math.min(current.duration, max)}
          min={MIN_TRANSITION}
          max={max}
          step={100}
          format={(v) => `${(v / 1000).toFixed(1)} s`}
          onChange={(duration) => editMedia(from.id, (c) => ({ ...c, transition: c.transition ? { ...c.transition, duration } : null }))}
        />
      )}
      {max < MIN_TRANSITION && <p className="text-sm text-neutral-500">Ces clips sont trop courts pour une transition (0,4 s minimum chacun).</p>}
    </>
  );
}
