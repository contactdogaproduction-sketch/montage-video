import { ExportButton } from '../features/export/ExportButton';
import { useProjectStore } from '../store/projectStore';
import { RedoIcon, UndoIcon } from '../ui/icons';

const historyButton =
  'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-35';

export function TopBar() {
  const canUndo = useProjectStore((s) => s.history.past.length > 0);
  const canRedo = useProjectStore((s) => s.history.future.length > 0);
  const name = useProjectStore((s) => s.history.present.name);

  return (
    <header className="flex items-center gap-1 border-b border-neutral-200 px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-1">
        <button type="button" className={historyButton} disabled={!canUndo} onClick={() => useProjectStore.getState().undo()} title="Annuler (Ctrl+Z)">
          <UndoIcon width={18} height={18} />
          Annuler
        </button>
        <button type="button" className={historyButton} disabled={!canRedo} onClick={() => useProjectStore.getState().redo()} title="Rétablir (Ctrl+Maj+Z)">
          <RedoIcon width={18} height={18} />
          Rétablir
        </button>
      </div>
      <h1 className="flex-1 truncate text-center text-sm font-semibold text-neutral-800">{name}</h1>
      <ExportButton />
    </header>
  );
}
