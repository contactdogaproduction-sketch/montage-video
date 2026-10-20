import { useEffect, useState } from 'react';
import type { MediaClip } from '../../core/types';
import { loadSegmenter, segmenterReady } from '../../engine/segmentation';
import { editMedia } from '../../store/editClip';
import { Field } from '../../ui/controls';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/** Suppression de l'arrière-plan d'une vidéo ou d'une photo : seule la personne reste visible. */
export function BackgroundPanel({ clip, overlay }: { clip: MediaClip; overlay: boolean }) {
  const [status, setStatus] = useState<Status>(segmenterReady() ? 'ready' : 'idle');
  const on = clip.removeBackground;

  // Détourage préparé dès que l'option est active (premier usage : quelques secondes).
  useEffect(() => {
    if (!on || segmenterReady()) return;
    let active = true;
    setStatus('loading');
    void loadSegmenter().then((ok) => {
      if (active) setStatus(ok ? 'ready' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [on]);

  return (
    <Field label="Arrière-plan">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => editMedia(clip.id, (c) => ({ ...c, removeBackground: !c.removeBackground }))}
        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
      >
        <span>Supprimer l’arrière-plan</span>
        <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-neutral-300'}`} aria-hidden="true">
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.125rem]' : 'left-0.5'}`} />
        </span>
      </button>
      {on && status === 'loading' && <p className="text-xs text-neutral-500">Préparation du détourage…</p>}
      {on && status === 'failed' && <p className="text-xs text-red-700">Le détourage n’a pas pu démarrer sur cet appareil.</p>}
      <p className="text-xs text-neutral-500">
        Garde les personnes et retire le décor, calculé sur l’appareil.
        {!overlay && ' Sur la piste principale, le décor devient noir : placez plutôt la vidéo en incrustation au-dessus d’un autre fond.'}
      </p>
    </Field>
  );
}
