import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { listenForInstallPrompt } from './features/install/installState';
import './index.css';

// Le navigateur propose l'installation très tôt : on écoute avant le premier rendu.
listenForInstallPrompt();

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
