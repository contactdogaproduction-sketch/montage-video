import { useRef, useState } from 'react';
import { projectDuration } from '../../core/project';
import { formatTime } from '../../core/time';
import { ExportCancelledError, exportProject, type ExportStage } from '../../engine/export/exportProject';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProject } from '../../store/projectStore';
import { DownloadIcon } from '../../ui/icons';
import { Modal } from '../../ui/Modal';

type ExportState =
  | { status: 'closed' }
  | { status: 'ready' }
  | { status: 'running'; ratio: number; stage: ExportStage }
  | { status: 'done'; url: string; size: number }
  | { status: 'error'; message: string };

const STAGE_LABELS: Record<ExportStage, string> = {
  prepare: 'Chargement de l’encodeur…',
  audio: 'Mixage du son…',
  video: 'Rendu et encodage des images…',
  finalize: 'Finalisation du fichier…',
};

const primary = 'flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong';
const secondary = 'w-full rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100';

export function ExportButton() {
  const project = useProject();
  const [state, setState] = useState<ExportState>({ status: 'closed' });
  const controller = useRef<AbortController | null>(null);
  const duration = projectDuration(project);

  const close = () => {
    if (state.status === 'done') URL.revokeObjectURL(state.url);
    setState({ status: 'closed' });
  };

  const start = async () => {
    useEditorStore.getState().setPlaying(false);
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', ratio: 0, stage: 'prepare' });
    try {
      const blob = await exportProject(getProject(), {
        signal: abort.signal,
        onProgress: ({ ratio, stage }) => setState({ status: 'running', ratio, stage }),
      });
      setState({ status: 'done', url: URL.createObjectURL(blob), size: blob.size });
    } catch (error) {
      if (error instanceof ExportCancelledError) setState({ status: 'ready' });
      else setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.current = null;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setState({ status: 'ready' })}
        disabled={duration === 0}
        className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-35"
      >
        <DownloadIcon width={18} height={18} />
        Exporter
      </button>

      {state.status !== 'closed' && (
        <Modal title="Exporter la vidéo">
          {state.status === 'ready' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600">
                MP4 · {project.width} × {project.height} · 30 images/s · durée {formatTime(duration)}
              </p>
              <p className="text-sm text-neutral-500">
                L’export se fait entièrement sur cet appareil et peut prendre plusieurs fois la durée de la vidéo. Gardez la page ouverte.
              </p>
              <button type="button" className={primary} onClick={start}>
                Lancer l’export
              </button>
              <button type="button" className={secondary} onClick={close}>
                Fermer
              </button>
            </div>
          )}

          {state.status === 'running' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600">{STAGE_LABELS[state.stage]}</p>
              <div
                className="h-3 overflow-hidden rounded-full bg-neutral-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(state.ratio * 100)}
              >
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${state.ratio * 100}%` }} />
              </div>
              <p className="text-right font-mono text-sm text-neutral-700 tabular-nums">{Math.round(state.ratio * 100)} %</p>
              <button type="button" className={secondary} onClick={() => controller.current?.abort()}>
                Annuler
              </button>
            </div>
          )}

          {state.status === 'done' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600">
                Votre vidéo est prête ({(state.size / 1024 / 1024).toFixed(1)} Mo).
              </p>
              <a href={state.url} download="montage.mp4" className={primary}>
                <DownloadIcon width={18} height={18} />
                Télécharger la vidéo
              </a>
              <button type="button" className={secondary} onClick={close}>
                Fermer
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-red-700">L’export a échoué : {state.message}</p>
              <button type="button" className={primary} onClick={start}>
                Réessayer
              </button>
              <button type="button" className={secondary} onClick={close}>
                Fermer
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
