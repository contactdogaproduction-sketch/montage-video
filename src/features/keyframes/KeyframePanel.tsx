import { clipEnd } from '../../core/clip';
import { KEYFRAME_TOLERANCE, addKeyframe, keyframeAt, removeKeyframe, setKeyframeEasing, transformAtTime } from '../../core/keyframes';
import type { Clip, Easing, Ms } from '../../core/types';
import { editClip, editTransform } from '../../store/editClip';
import { useEditorStore } from '../../store/editorStore';
import { Field, Segmented } from '../../ui/controls';
import { TransformFields } from '../../ui/TransformFields';

const EASINGS: { value: Easing; label: string }[] = [
  { value: 'linear', label: 'Linéaire' },
  { value: 'ease-in-out', label: 'Douce' },
];

const button =
  'rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-35';

function goTo(t: Ms): void {
  const editor = useEditorStore.getState();
  editor.setPlaying(false);
  editor.setPlayhead(t);
}

/** Keyframes du clip : ajout et suppression au curseur, navigation, interpolation. */
export function KeyframePanel({ clip }: { clip: Clip }) {
  const playhead = useEditorStore((s) => s.playhead);
  const inside = clip.start <= playhead && playhead < clipEnd(clip);
  const current = inside ? keyframeAt(clip, playhead) : undefined;
  const times = clip.keyframes.map((k) => clip.start + k.time);
  const previous = [...times].reverse().find((t) => t < playhead - KEYFRAME_TOLERANCE);
  const next = times.find((t) => t > playhead + KEYFRAME_TOLERANCE);
  const count = clip.keyframes.length;

  return (
    <Field label={`Keyframes (${count})`}>
      <div className="flex flex-wrap gap-1.5">
        {current ? (
          <button type="button" className={button} onClick={() => editClip(clip.id, (c) => removeKeyframe(c, playhead))}>
            Supprimer la keyframe
          </button>
        ) : (
          <button type="button" className={button} disabled={!inside} onClick={() => editClip(clip.id, (c) => addKeyframe(c, playhead))}>
            ◆ Ajouter une keyframe
          </button>
        )}
        <button type="button" className={button} disabled={previous === undefined} onClick={() => previous !== undefined && goTo(previous)}>
          ◀ Précédente
        </button>
        <button type="button" className={button} disabled={next === undefined} onClick={() => next !== undefined && goTo(next)}>
          Suivante ▶
        </button>
      </div>
      {!inside && <p className="text-xs text-neutral-500">Placez le curseur sur le clip pour ajouter une keyframe.</p>}
      {count > 0 && inside && (
        <p className="text-xs text-neutral-500">Chaque réglage modifié ici ou dans l’aperçu crée une keyframe au curseur.</p>
      )}
      {current && (
        <Segmented
          label="Mouvement jusqu’à la keyframe suivante"
          value={current.easing}
          options={EASINGS}
          onChange={(easing) => editClip(clip.id, (c) => setKeyframeEasing(c, playhead, easing))}
        />
      )}
    </Field>
  );
}

/** Placement de l'élément au curseur (taille, rotation, opacité, position) et ses keyframes. */
export function TransformSection({ clip, maxScale }: { clip: Clip; maxScale?: number }) {
  const playhead = useEditorStore((s) => s.playhead);
  return (
    <>
      <TransformFields transform={transformAtTime(clip, playhead)} onChange={(update) => editTransform(clip.id, update)} maxScale={maxScale} />
      <KeyframePanel clip={clip} />
    </>
  );
}
