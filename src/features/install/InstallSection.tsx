import { useState } from 'react';
import { detectPlatform, promptInstall, useInstallStore } from './installState';

const button = 'w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left font-medium text-neutral-800 hover:bg-neutral-50';

/**
 * Installer l'application : raccourci sur le bureau et fenêtre d'app sur ordinateur (Chrome, Edge),
 * icône sur l'écran d'accueil du téléphone. Une fois installée, elle fonctionne sans connexion.
 */
export function InstallSection() {
  const { prompt, installed } = useInstallStore();
  const [help, setHelp] = useState(false);
  const platform = detectPlatform();

  if (installed) {
    return <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ Application installée sur cet appareil.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={button} onClick={() => (prompt ? void promptInstall() : setHelp(true))}>
        ⬇ Installer l’application
        <span className="block text-xs font-normal text-neutral-500">
          {platform === 'ios' ? 'Icône sur l’écran d’accueil, utilisable sans connexion' : 'Raccourci sur le bureau, fenêtre d’application, utilisable sans connexion'}
        </span>
      </button>
      {help && (
        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {platform === 'ios' ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Ouvrez cette page dans <strong>Safari</strong> (adresse en https).</li>
              <li>
                Touchez le bouton <strong>Partager</strong> (carré avec une flèche vers le haut).
              </li>
              <li>
                Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.
              </li>
            </ol>
          ) : platform === 'chromium' ? (
            <p>
              Dans la barre d’adresse, cliquez sur l’icône <strong>« Installer »</strong> (écran avec une flèche), ou ouvrez le menu ⋮ puis{' '}
              <strong>« Installer Montage vidéo »</strong> (Edge : <strong>Applications → Installer ce site en tant qu’application</strong>). Un
              raccourci est ajouté sur le bureau.
            </p>
          ) : (
            <p>
              Ce navigateur ne sait pas installer d’application. Ouvrez l’adresse en ligne dans <strong>Chrome</strong> ou <strong>Edge</strong>{' '}
              sur ordinateur, ou dans <strong>Safari</strong> sur iPhone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
