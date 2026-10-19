import { projectDuration } from '../core/project';
import { formatTime } from '../core/time';
import { togglePlayback } from '../engine/preview/playback';
import { useEditorStore } from '../store/editorStore';
import { useProject } from '../store/projectStore';
import { PauseIcon, PlayIcon } from '../ui/icons';

export function PlaybackBar() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const duration = projectDuration(project);

  return (
    <div className="flex items-center justify-center gap-4 px-4 pb-1">
      <span className="flex-1 text-right font-mono whitespace-nowrap text-xs text-neutral-500 tabular-nums">
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
