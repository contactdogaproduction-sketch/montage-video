import { useEffect, useRef } from 'react';
import { projectDuration } from '../core/project';
import { formatTime } from '../core/time';
import { togglePlayback } from '../engine/preview/playback';
import { useEditorStore } from '../store/editorStore';
import { onPlaybackTime } from '../store/playbackClock';
import { useProject } from '../store/projectStore';
import { PauseIcon, PlayIcon } from '../ui/icons';

export function PlaybackBar() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const duration = projectDuration(project);
  const timeRef = useRef<HTMLSpanElement>(null);

  // Pendant la lecture, le compteur suit chaque image sans recalculer le composant.
  useEffect(
    () =>
      onPlaybackTime((t) => {
        const text = `${formatTime(t)} / ${formatTime(duration)}`;
        // Texte modifié seulement quand il change (chaque modification recalcule la mise en page).
        if (timeRef.current && timeRef.current.textContent !== text) timeRef.current.textContent = text;
      }),
    [duration],
  );

  return (
    <div className="flex items-center justify-center gap-4 px-4 pb-1">
      <span ref={timeRef} className="flex-1 text-right font-mono whitespace-nowrap text-xs text-neutral-500 tabular-nums">
        {formatTime(playhead)} / {formatTime(duration)}
      </span>
      <button
        type="button"
        onClick={togglePlayback}
        disabled={duration === 0}
        className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-35"
        title="Lecture / pause (Espace)"
      >
        {playing ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
        {playing ? 'Pause' : 'Lecture'}
      </button>
      <span className="flex-1" />
    </div>
  );
}
