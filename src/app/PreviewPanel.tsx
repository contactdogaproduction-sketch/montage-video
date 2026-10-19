import { useEffect, useRef, useState } from 'react';
import { fitContain } from '../core/geometry';
import { PreviewPlayer } from '../engine/preview/PreviewPlayer';
import { attachPlayer } from '../engine/preview/playback';
import { SelectionOverlay } from '../features/transform/SelectionOverlay';
import { useEditorStore } from '../store/editorStore';
import { getProject, useProject, useProjectStore } from '../store/projectStore';

export function PreviewPanel() {
  const project = useProject();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Création du lecteur et synchronisation avec les stores.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const player = new PreviewPlayer(canvas, getProject(), {
      onTime: (t) => useEditorStore.getState().setPlayhead(t),
      onEnded: () => useEditorStore.getState().setPlaying(false),
    });
    playerRef.current = player;
    attachPlayer(player);

    const unsubProject = useProjectStore.subscribe((s) => player.setProject(s.history.present));
    const unsubEditor = useEditorStore.subscribe((s) => {
      if (!s.playing && player.isPlaying) player.pause();
      if (!s.playing && Math.abs(s.playhead - player.currentTime) >= 1) player.seek(s.playhead);
    });
    player.seek(useEditorStore.getState().playhead);

    return () => {
      unsubProject();
      unsubEditor();
      attachPlayer(null);
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  // L'aperçu garde le ratio du projet dans l'espace disponible.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const rect = fitContain(project.width, project.height, width, height);
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [project.width, project.height]);

  useEffect(() => {
    playerRef.current?.resize(size.width, size.height);
  }, [size]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center p-3">
      <div className="relative" style={{ width: size.width, height: size.height }}>
        <canvas
          ref={canvasRef}
          className="block rounded-xl bg-black shadow-sm"
          style={{ width: size.width, height: size.height }}
          aria-label="Aperçu de la vidéo"
        />
        <SelectionOverlay width={size.width} />
      </div>
    </div>
  );
}
