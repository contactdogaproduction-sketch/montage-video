import { useRef, useState } from 'react';
import { applySubtitles, hasSubtitles, segmentTranscript } from '../../core/subtitles';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProject, useProjectStore } from '../../store/projectStore';
import { Segmented } from '../../ui/controls';
import { Modal } from '../../ui/Modal';
import { ToolButton } from '../../ui/ToolButton';
import { MODEL_CHOICES, type ModelChoice, type TranscriptLanguage } from './protocol';
import { prepareTranscriber, projectHasSound, transcribeProject, useModelStore, type TranscriptionStage } from './transcribe';

type Language = 'fr' | 'en' | 'auto';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'auto', label: 'Détection automatique' },
];

const QUALITY_KEY = 'montage-video.subtitles.quality';

/** Qualité retenue sur cet appareil (simple confort : « Rapide » si rien n'est enregistré). */
function savedQuality(): ModelChoice {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'accurate' ? 'accurate' : 'fast';
  } catch {
    return 'fast';
  }
}

const QUALITIES: { value: ModelChoice; label: string }[] = (Object.keys(MODEL_CHOICES) as ModelChoice[]).map((value) => ({
  value,
  label: `${MODEL_CHOICES[value].label} (${MODEL_CHOICES[value].sizeMb} Mo)`,
}));

type State =
  | { status: 'closed' }
  | { status: 'ready' }
  | { status: 'running'; stage: TranscriptionStage }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string };

const STAGES: Record<TranscriptionStage, string> = {
  audio: 'Préparation du son…',
  model: 'Chargement du modèle de reconnaissance…',
  transcribe: 'Transcription en cours (cela peut prendre environ la durée de la vidéo)…',
};

const CcIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="3" />
    <path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" />
  </svg>
);

const primary = 'w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-35';
const secondary = 'w-full rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100';

/** Sous-titres automatiques : transcription sur l'appareil, découpage en segments courts, style Reels. */
export function SubtitlesButton() {
  const project = useProject();
  const [state, setState] = useState<State>({ status: 'closed' });
  const [language, setLanguage] = useState<Language>('fr');
  const [quality, setQuality] = useState<ModelChoice>(savedQuality);
  const controller = useRef<AbortController | null>(null);
  const existing = hasSubtitles(project);
  const sound = projectHasSound(project);

  const model = useModelStore();

  /** Ouvre la fenêtre et commence à préparer le modèle, pour gagner du temps. */
  const open = () => {
    setState({ status: 'ready' });
    if (sound) prepareTranscriber(quality);
  };

  const chooseQuality = (choice: ModelChoice) => {
    setQuality(choice);
    try {
      localStorage.setItem(QUALITY_KEY, choice);
    } catch {
      // Stockage indisponible : le choix vaut pour cette session.
    }
    if (sound) prepareTranscriber(choice);
  };

  const start = async () => {
    useEditorStore.getState().setPlaying(false);
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', stage: 'audio' });
    try {
      const chunks = await transcribeProject(getProject(), language === 'auto' ? null : (language as TranscriptLanguage), quality, abort.signal, (stage) =>
        setState((s) => (s.status === 'running' ? { ...s, stage } : s)),
      );
      const segments = segmentTranscript(chunks);
      if (segments.length > 0) {
        useProjectStore.getState().commit((p) => applySubtitles(p, segments, createId(), createId));
      }
      setState({ status: 'done', count: segments.length });
    } catch (error) {
      if (abort.signal.aborted) setState({ status: 'ready' });
      else setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.current = null;
    }
  };

  return (
    <>
      <ToolButton icon={<CcIcon />} label="Sous-titres" onClick={open} title="Générer les sous-titres automatiquement" />
      {state.status !== 'closed' && (
        <Modal title="Sous-titres automatiques">
          {state.status === 'ready' && (
            <div className="flex flex-col gap-3">
              <Segmented label="Langue parlée" value={language} options={LANGUAGES} onChange={setLanguage} />
              <Segmented label="Qualité" value={quality} options={QUALITIES} onChange={chooseQuality} />
              <p className="text-sm text-neutral-500">
                {quality === 'fast'
                  ? 'Rapide : bon résultat pour une voix claire, transcription à peu près en temps réel.'
                  : 'Précis : bien plus fiable en français (accents, débit rapide), mais 3 à 4 fois plus lent.'}{' '}
                Tout se fait sur cet appareil ; le modèle est téléchargé une seule fois puis gardé (en Wi-Fi de préférence).
              </p>
              {model.status === 'loading' && (
                <p className="text-sm text-neutral-600">
                  Préparation du modèle en arrière-plan
                  {model.download !== null && model.download < 1 ? ` : téléchargement ${Math.round(model.download * 100)} %` : '…'}
                </p>
              )}
              {model.status === 'ready' && <p className="text-sm text-emerald-700">Modèle prêt.</p>}
              {!sound && <p className="text-sm text-amber-700">Ajoutez d’abord une vidéo avec du son ou un fichier audio.</p>}
              <button type="button" className={primary} disabled={!sound} onClick={() => void start()}>
                {existing ? 'Régénérer (remplace les sous-titres actuels)' : 'Générer les sous-titres'}
              </button>
              <button type="button" className={secondary} onClick={() => setState({ status: 'closed' })}>
                Fermer
              </button>
            </div>
          )}

          {state.status === 'running' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600">{STAGES[state.stage]}</p>
              {state.stage === 'model' && model.download !== null && model.download < 1 && (
                <>
                  <div className="h-3 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(model.download * 100)}>
                    <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${model.download * 100}%` }} />
                  </div>
                  <p className="text-right font-mono text-sm text-neutral-700 tabular-nums">Téléchargement : {Math.round(model.download * 100)} %</p>
                </>
              )}
              {state.stage !== 'model' && (
                <div className="h-3 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-label="En cours">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
                </div>
              )}
              <button type="button" className={secondary} onClick={() => controller.current?.abort()}>
                Annuler
              </button>
            </div>
          )}

          {state.status === 'done' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600">
                {state.count > 0
                  ? `${state.count} sous-titres ajoutés. Touchez-en un dans la timeline pour corriger le texte ou le style.`
                  : 'Aucune parole n’a été détectée dans le son du projet.'}
              </p>
              <button type="button" className={primary} onClick={() => setState({ status: 'closed' })}>
                Terminé
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-red-700">La transcription a échoué : {state.message}</p>
              <p className="text-sm text-neutral-500">Le premier usage nécessite une connexion Internet pour télécharger le modèle.</p>
              <button type="button" className={primary} onClick={() => void start()}>
                Réessayer
              </button>
              <button type="button" className={secondary} onClick={() => setState({ status: 'closed' })}>
                Fermer
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
