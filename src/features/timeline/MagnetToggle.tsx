import { getMainTrack, setMainMagnet } from '../../core/project';
import { useProject, useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';

const MagnetIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3v8a6 6 0 0 0 12 0V3" />
    <path d="M6 3h4v8a2 2 0 0 0 4 0V3h4M6 7h4M14 7h4" />
  </svg>
);

/**
 * Aimant de la piste principale. Activé : clips accolés sans trou. Désactivé : clips placés
 * librement (espaces noirs possibles) ; les transitions demandent l'aimant.
 */
export function MagnetToggle() {
  const project = useProject();
  const on = getMainTrack(project).magnetic;

  const toggle = () => {
    useProjectStore.getState().commit((p) => setMainMagnet(p, !on));
    notify(
      on
        ? 'Aimant désactivé : les clips de la piste principale se placent librement (les transitions sont mises en pause).'
        : 'Aimant activé : les clips de la piste principale sont à nouveau accolés.',
    );
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title="Aimant de la piste principale : clips accolés automatiquement"
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${on ? 'bg-accent/10 text-accent' : 'text-neutral-600 hover:bg-neutral-200'}`}
    >
      <MagnetIcon />
      {on ? 'Aimant activé' : 'Aimant désactivé'}
    </button>
  );
}
