import { useEffect, useState, type ReactNode } from 'react';
import { formatDate, formatTime } from '../../core/time';
import { listProjects, storageUsage, type ProjectSummary } from '../../store/persistence';
import { useProject } from '../../store/projectStore';
import { CloseIcon, PlusIcon } from '../../ui/icons';
import { Modal } from '../../ui/Modal';
import { createNewProject, deleteProject, openProject, renameProject, saveNow, useSessionStore } from './session';

const small = 'rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100';

/** Écran « Mes projets » : projets enregistrés sur l'appareil. */
/** `footer` : contenu ajouté sous la liste (réglages de l'application). */
export function ProjectsScreen({ footer }: { footer?: ReactNode }) {
  const current = useProject();
  const close = () => useSessionStore.getState().setProjectsOpen(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [usage, setUsage] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

  const refresh = async () => {
    await saveNow();
    setProjects(await listProjects());
    setUsage(await storageUsage());
  };
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (action: Promise<void>, closeAfter: boolean) => {
    await action;
    if (closeAfter) close();
    else await refresh();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label="Mes projets">
      <header className="flex h-14 items-center gap-2 border-b border-neutral-200 px-4">
        <h2 className="flex-1 text-lg font-semibold">Mes projets</h2>
        <button type="button" onClick={close} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          <CloseIcon width={16} height={16} />
          Fermer
        </button>
      </header>
      <div className="bg-brand-pattern flex-1 overflow-y-auto px-4 py-4">
        <button
          type="button"
          onClick={() => void run(createNewProject(), true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong"
        >
          <PlusIcon width={18} height={18} />
          Nouveau projet
        </button>
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                {p.cover && <img src={p.cover} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.name} {p.id === current.id && <span className="text-xs text-accent">(ouvert)</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  Modifié le {formatDate(p.updatedAt)} · {formatTime(p.duration)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.id !== current.id && (
                    <button type="button" className={small} onClick={() => void run(openProject(p.id), true)}>
                      Ouvrir
                    </button>
                  )}
                  <button type="button" className={small} onClick={() => setRenaming(p)}>
                    Renommer
                  </button>
                  <button type="button" className={small} onClick={() => setDeleting(p)}>
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-neutral-500">
          Vos projets sont enregistrés uniquement sur cet appareil
          {usage !== null && ` (${(usage / 1024 / 1024).toFixed(0)} Mo utilisés)`}.
        </p>
        {footer}
      </div>

      {renaming && (
        <Modal title="Renommer le projet">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get('name') ?? '');
              setRenaming(null);
              void run(renameProject(renaming.id, name), false);
            }}
            className="flex flex-col gap-3"
          >
            <input name="name" defaultValue={renaming.name} autoFocus className="rounded-xl border border-neutral-200 px-3 py-2 text-base focus:border-accent focus:outline-none" />
            <button type="submit" className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white">
              Enregistrer
            </button>
            <button type="button" onClick={() => setRenaming(null)} className="rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100">
              Annuler
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Supprimer le projet ?">
          <p className="mb-4 text-sm text-neutral-600">« {deleting.name} » et ses fichiers seront définitivement supprimés de cet appareil.</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                const id = deleting.id;
                setDeleting(null);
                void run(deleteProject(id), false);
              }}
              className="rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white"
            >
              Supprimer définitivement
            </button>
            <button type="button" onClick={() => setDeleting(null)} className="rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100">
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
