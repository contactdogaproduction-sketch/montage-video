import { useEffect, useRef, useState } from 'react';
import { createMediaClip } from '../../core/clip';
import { addMedia, placeClip, projectDuration } from '../../core/project';
import { formatTime } from '../../core/time';
import type { Ms } from '../../core/types';
import { setPreviewMuted, togglePlayback } from '../../engine/preview/playback';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { currentPlaybackTime } from '../../store/playbackClock';
import { registerMedia } from '../../store/mediaRegistry';
import { getProject, useProjectStore } from '../../store/projectStore';
import { Segmented } from '../../ui/controls';
import { Modal } from '../../ui/Modal';
import { ToolButton } from '../../ui/ToolButton';
import { readMedia } from '../import/readMedia';
import { canRecord, microphoneErrorMessage, startVoiceRecording, type VoiceRecording } from './record';

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);

type VideoSound = 'muted' | 'on';

type State =
  | { status: 'closed' }
  | { status: 'ready' }
  | { status: 'recording'; startAt: Ms; startedAt: number }
  | { status: 'saving' }
  | { status: 'error'; message: string };

const primary = 'w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-35';
const secondary = 'w-full rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100';

let takeCount = 0;

/**
 * Voix off (doublage) : la vidéo se lit depuis le curseur pendant que le micro enregistre ;
 * la voix est ajoutée sur une piste audio, calée à l'endroit où l'enregistrement a commencé.
 */
export function VoiceOverButton() {
  const [state, setState] = useState<State>({ status: 'closed' });
  const [videoSound, setVideoSound] = useState<VideoSound>('muted');
  const [elapsed, setElapsed] = useState(0);
  const recording = useRef<VoiceRecording | null>(null);

  useEffect(() => {
    if (state.status !== 'recording') return;
    const timer = window.setInterval(() => setElapsed(performance.now() - state.startedAt), 200);
    return () => window.clearInterval(timer);
  }, [state]);

  // Fermeture de l'app ou du composant en plein enregistrement : on libère le micro.
  useEffect(() => () => recording.current?.cancel(), []);

  const stopPreview = () => {
    if (useEditorStore.getState().playing) togglePlayback();
    setPreviewMuted(false);
  };

  /** Démarre dans le geste de l'utilisateur (autorisation du micro et lecture avec son). */
  const start = async () => {
    const editor = useEditorStore.getState();
    // La lecture démarre dans le geste (exigence de Safari), avant la demande d'accès au micro ;
    // la vidéo défile pendant l'enregistrement, sauf si le curseur est déjà à la fin.
    setPreviewMuted(videoSound === 'muted');
    if (!editor.playing && editor.playhead < projectDuration(getProject())) togglePlayback();
    try {
      takeCount += 1;
      recording.current = await startVoiceRecording(`Voix off ${takeCount}`);
    } catch (error) {
      stopPreview();
      setState({ status: 'error', message: microphoneErrorMessage(error) });
      return;
    }
    // La voix est calée sur l'instant où le micro a réellement commencé à enregistrer.
    const startAt = useEditorStore.getState().playing ? Math.round(currentPlaybackTime()) : useEditorStore.getState().playhead;
    setElapsed(0);
    setState({ status: 'recording', startAt, startedAt: performance.now() });
  };

  const stop = async () => {
    if (state.status !== 'recording' || !recording.current) return;
    const { startAt } = state;
    stopPreview();
    setState({ status: 'saving' });
    try {
      const file = await recording.current.stop();
      recording.current = null;
      const id = createId();
      const { info, url, thumbnail } = await readMedia(file, id);
      registerMedia(id, { file, url, thumbnail });
      const clip = createMediaClip(createId(), info, startAt);
      useProjectStore.getState().commit((p) => placeClip(addMedia(p, [info]), clip, createId()));
      useEditorStore.getState().select(clip.id);
      setState({ status: 'closed' });
    } catch {
      setState({ status: 'error', message: 'L’enregistrement n’a pas pu être lu. Réessayez.' });
    }
  };

  const cancel = () => {
    recording.current?.cancel();
    recording.current = null;
    stopPreview();
    setState({ status: 'ready' });
  };

  const playhead = useEditorStore((s) => s.playhead);

  return (
    <>
      <ToolButton icon={<MicIcon />} label="Voix off" onClick={() => setState({ status: 'ready' })} title="Enregistrer ma voix sur la vidéo (doublage)" />
      {state.status !== 'closed' && (
        <Modal title="Enregistrer ma voix">
          {state.status === 'ready' &&
            (canRecord() ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-neutral-600">
                  L’enregistrement commence au curseur ({formatTime(playhead)}) : la vidéo se lit en même temps pour caler votre voix. Elle sera
                  ajoutée sur une piste audio, à cet endroit.
                </p>
                <Segmented
                  label="Son de la vidéo pendant l’enregistrement"
                  value={videoSound}
                  options={[
                    { value: 'muted', label: 'Coupé (évite l’écho)' },
                    { value: 'on', label: 'Activé (avec écouteurs)' },
                  ]}
                  onChange={setVideoSound}
                />
                <button type="button" className={primary} onClick={() => void start()}>
                  ● Enregistrer
                </button>
                <button type="button" className={secondary} onClick={() => setState({ status: 'closed' })}>
                  Fermer
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-amber-700">
                  Le micro n’est accessible que sur une adresse sécurisée : utilisez la version en ligne de l’application (https).
                </p>
                <button type="button" className={secondary} onClick={() => setState({ status: 'closed' })}>
                  Fermer
                </button>
              </div>
            ))}

          {state.status === 'recording' && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-lg font-semibold text-red-600" role="status">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
                Enregistrement… {formatTime(elapsed)}
              </p>
              <button type="button" className={primary} onClick={() => void stop()}>
                ■ Arrêter et ajouter
              </button>
              <button type="button" className={secondary} onClick={cancel}>
                Annuler
              </button>
            </div>
          )}

          {state.status === 'saving' && <p className="text-sm text-neutral-600">Ajout de la voix au montage…</p>}

          {state.status === 'error' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-red-700">{state.message}</p>
              <button type="button" className={secondary} onClick={() => setState({ status: 'ready' })}>
                Réessayer
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
