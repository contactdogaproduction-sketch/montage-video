import { MAX_VOLUME } from '../../core/clip';
import { setTrackVolume } from '../../core/project';
import type { MediaClip, Track } from '../../core/types';
import { editMedia } from '../../store/editClip';
import { useProjectStore } from '../../store/projectStore';
import { Slider } from '../../ui/controls';

const percent = (v: number) => `${Math.round(v * 100)} %`;
const seconds = (ms: number) => (ms === 0 ? 'Aucun' : `${(ms / 1000).toFixed(1)} s`);
/** Durée maximale d'un fondu (ms). */
const MAX_FADE = 5000;

/** Volume du clip et de sa piste, fondus d'entrée et de sortie (vidéos et fichiers audio). */
export function AudioPanel({ clip, track }: { clip: MediaClip; track: Track }) {
  const maxFade = Math.min(MAX_FADE, clip.duration);
  return (
    <>
      <Slider label="Volume du clip" value={clip.volume} min={0} max={MAX_VOLUME} step={0.05} format={percent} onChange={(volume) => editMedia(clip.id, (c) => ({ ...c, volume }))} />
      <Slider
        label="Volume de la piste"
        value={track.volume}
        min={0}
        max={MAX_VOLUME}
        step={0.05}
        format={percent}
        onChange={(volume) => useProjectStore.getState().apply((project) => setTrackVolume(project, track.id, volume))}
      />
      <Slider label="Fondu d’entrée" value={Math.min(clip.fadeIn, maxFade)} min={0} max={maxFade} step={100} format={seconds} onChange={(fadeIn) => editMedia(clip.id, (c) => ({ ...c, fadeIn }))} />
      <Slider label="Fondu de sortie" value={Math.min(clip.fadeOut, maxFade)} min={0} max={maxFade} step={100} format={seconds} onChange={(fadeOut) => editMedia(clip.id, (c) => ({ ...c, fadeOut }))} />
    </>
  );
}
