import { formatRulerLabel, rulerStep } from '../../core/time';
import type { Ms } from '../../core/types';

interface RulerProps {
  /** Durée couverte par la règle. */
  span: Ms;
  pxPerSecond: number;
  offset: number;
}

export function Ruler({ span, pxPerSecond, offset }: RulerProps) {
  const step = rulerStep(pxPerSecond);
  const ticks: Ms[] = [];
  for (let t = 0; t <= span; t += step) ticks.push(t);

  return (
    <>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 h-full border-l border-neutral-300 pl-1 text-[10px] leading-4 text-neutral-500 select-none"
          style={{ left: offset + (t / 1000) * pxPerSecond }}
        >
          {formatRulerLabel(t)}
        </div>
      ))}
    </>
  );
}
