import { useEffect, useState } from 'react';

type Status = 'ready' | 'pending' | 'insecure';

/** L'application (montage, aperçu, export) est-elle utilisable sans connexion sur cet appareil ? */
export function OfflineStatus() {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      setStatus('insecure');
      return;
    }
    // Service worker actif = application et export (FFmpeg) déjà gardés sur l'appareil.
    void navigator.serviceWorker.getRegistration().then((registration) => setStatus(registration?.active ? 'ready' : 'pending'));
  }, []);

  if (status === 'ready') {
    return <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ Montage et export fonctionnent sans connexion sur cet appareil.</p>;
  }
  if (status === 'insecure') {
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Cette adresse n’est pas sécurisée (http) : pas d’utilisation hors ligne ni de micro. Utilisez la version en ligne (https) et installez-la.
      </p>
    );
  }
  return <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Préparation de l’utilisation hors ligne… Rouvrez l’application une fois.</p>;
}
