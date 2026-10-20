import { realpathSync } from 'node:fs';
import { searchForWorkspaceRoot } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Isolation cross-origin en développement (prépare un éventuel FFmpeg multi-thread).
// Elle n'est pas nécessaire au fonctionnement : FFmpeg mono-thread marche sans, y compris sur
// GitHub Pages qui ne permet pas de définir ces en-têtes.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const root = process.cwd();

// Version affichée dans « Mes projets » : date de publication (heure de Paris) et commit publié.
const buildDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date());
const appVersion = `${buildDate} (${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'})`;

export default defineConfig({
  // Chemin de publication : « /nom-du-depot/ » sur GitHub Pages (fourni par le workflow), « / » sinon.
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // L'utilisateur choisit quand appliquer une mise à jour (pas de rechargement en plein montage).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Montage vidéo',
        short_name: 'Montage',
        description: 'Montage de vidéos courtes pour Reels, TikTok et Shorts, directement sur l’appareil.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est mis en cache à l'installation, FFmpeg compris : l'app fonctionne hors ligne.
        globPatterns: ['**/*.{js,css,html,wasm,woff2,png,tflite}'],
        // Moteur de transcription (14 Mo) : mis en cache au premier usage des sous-titres, avec le modèle,
        // plutôt qu'à l'installation (qui reste légère).
        globIgnores: ['**/ort-wasm-*'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    headers: isolationHeaders,
    // Le chemin réel du projet peut différer de son chemin apparent (dossier virtualisé, lien) :
    // on autorise les deux pour que le worker de FFmpeg soit servi.
    fs: { allow: [searchForWorkspaceRoot(root), realpathSync.native(root)] },
  },
  preview: { headers: isolationHeaders },
  // Le worker de @ffmpeg/ffmpeg est résolu par URL relative : il ne doit pas être pré-bundlé.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
