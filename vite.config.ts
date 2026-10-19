import { realpathSync } from 'node:fs';
import { searchForWorkspaceRoot } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// FFmpeg.wasm a besoin d'un contexte isolé (SharedArrayBuffer) : en-têtes COOP/COEP.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const root = process.cwd();

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
