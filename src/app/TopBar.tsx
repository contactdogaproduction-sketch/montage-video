import { logoUrl } from '../engine/logo';
import { ExportButton } from '../features/export/ExportButton';
import { useSessionStore } from '../features/projects/session';
import { useProjectStore } from '../store/projectStore';
import { RedoIcon, UndoIcon } from '../ui/icons';

const barButton =
  'flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-35';

export function TopBar() {
  const canUndo = useProjectStore((s) => s.history.past.length > 0);
  const canRedo = useProjectStore((s) => s.history.future.length > 0);
  const name = useProjectStore((s) => s.history.present.name);

  return (
    <header className="flex items-center gap-1 border-b border-neutral-200 px-2 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-0.5">
        <button type="button" className={barButton} onClick={() => useSessionStore.getState().setProjectsOpen(true)} title="Mes projets">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          Projets
        </button>
        <button type="button" className={barButton} disabled={!canUndo} onClick={() => useProjectStore.getState().undo()} title="Annuler (Ctrl+Z)">
          <UndoIcon width={18} height={18} />
          Annuler
        </button>
        <button type="button" className={barButton} disabled={!canRedo} onClick={() => useProjectStore.getState().redo()} title="Rétablir (Ctrl+Maj+Z)">
          <RedoIcon width={18} height={18} />
          Rétablir
        </button>
      </div>
      <h1 className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-neutral-800">
        <img src={logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-md bg-neutral-900 object-contain p-0.5" />
        <span className="truncate">{name}</span>
      </h1>
      <ExportButton />
    </header>
  );
}
