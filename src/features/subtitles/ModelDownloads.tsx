import { useEffect, useState } from 'react';
import { MODEL_CHOICES, type ModelChoice } from './protocol';
import { isModelDownloaded, prepareTranscriber, useModelStore } from './transcribe';

const CHOICES = Object.keys(MODEL_CHOICES) as ModelChoice[];

/**
 * Télécharger à l'avance les modèles de sous-titres (en Wi-Fi) pour pouvoir sous-titrer
 * sans connexion ensuite.
 */
export function ModelDownloads() {
  const model = useModelStore();
  const [downloaded, setDownloaded] = useState<Partial<Record<ModelChoice, boolean>>>({});
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Vérifié à l'ouverture et à chaque modèle prêt (fin d'un téléchargement).
  useEffect(() => {
    void Promise.all(CHOICES.map(async (c) => [c, await isModelDownloaded(c)] as const)).then((entries) => setDownloaded(Object.fromEntries(entries)));
  }, [model.status]);

  return (
    <ul className="flex flex-col gap-2">
      {CHOICES.map((choice) => {
        const { label, sizeMb } = MODEL_CHOICES[choice];
        const loading = model.model === choice && model.status === 'loading';
        return (
          <li key={choice} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
            <span className="flex-1">
              Sous-titres <strong>{label}</strong> ({sizeMb} Mo)
            </span>
            {downloaded[choice] ? (
              <span className="text-emerald-700">✓ Hors ligne</span>
            ) : loading ? (
              <span className="text-neutral-600 tabular-nums">
                {model.download !== null && model.download < 1 ? `${Math.round(model.download * 100)} %` : 'Préparation…'}
              </span>
            ) : (
              <button
                type="button"
                disabled={!online}
                onClick={() => prepareTranscriber(choice)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                title={online ? 'Télécharger maintenant pour sous-titrer sans connexion' : 'Connexion nécessaire'}
              >
                {online ? 'Télécharger' : 'Connexion nécessaire'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
