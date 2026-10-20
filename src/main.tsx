import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyBrandPattern } from './app/brandPattern';
import { listenForInstallPrompt } from './features/install/installState';
import { startPreviewCopies } from './features/previewCopy/previewCopies';
import './index.css';

// Le navigateur propose l'installation très tôt : on écoute avant le premier rendu.
listenForInstallPrompt();
void applyBrandPattern();
// Avant l'ouverture du dernier projet : ses vidéos sans copie allégée seront converties.
startPreviewCopies();

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
