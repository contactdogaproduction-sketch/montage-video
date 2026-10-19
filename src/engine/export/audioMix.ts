import { trackFades } from '../../core/audio';
import { clipEnd } from '../../core/clip';
import { projectDuration } from '../../core/project';
import type { Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';

export const EXPORT_SAMPLE_RATE = 48000;

/**
 * Change la vitesse d'un extrait sonore sans changer la hauteur de la voix
 * (fourni par l'export, qui utilise le filtre `atempo` de FFmpeg).
 */
export type TimeStretcher = (segment: AudioBuffer, speed: number) => Promise<AudioBuffer>;

/** Copie le passage [from, from + length[ (en secondes) d'un son décodé. */
function sliceBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, from: number, length: number): AudioBuffer {
  const start = Math.max(0, Math.round(from * buffer.sampleRate));
  const end = Math.min(buffer.length, start + Math.round(length * buffer.sampleRate));
  const slice = ctx.createBuffer(buffer.numberOfChannels, Math.max(1, end - start), buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) slice.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  return slice;
}

/**
 * Mixe le son de toutes les pistes (vidéos et fichiers audio) avec volumes, fondus et vitesses.
 * Silence si aucun clip n'a de son.
 */
export async function mixProjectAudio(project: Project, signal: AbortSignal, stretch?: TimeStretcher): Promise<AudioBuffer> {
  const seconds = projectDuration(project) / 1000;
  const length = Math.max(1, Math.ceil(seconds * EXPORT_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(2, length, EXPORT_SAMPLE_RATE);
  const decoded = new Map<string, AudioBuffer | null>();

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      signal.throwIfAborted();
      if (clip.type !== 'media') continue;
      const media = project.media[clip.mediaId];
      if (!media || media.kind === 'image') continue;
      if (!decoded.has(media.id)) {
        const source = getMediaSource(media.id);
        let buffer: AudioBuffer | null = null;
        if (source) {
          try {
            buffer = await ctx.decodeAudioData(await source.file.arrayBuffer());
          } catch {
            // Vidéo sans piste audio : le clip reste muet.
            buffer = null;
          }
        }
        decoded.set(media.id, buffer);
      }
      const buffer = decoded.get(media.id);
      const level = track.volume * clip.volume;
      if (!buffer || level === 0) continue;

      const start = clip.start / 1000;
      const end = clipEnd(clip) / 1000;
      // Fondus du clip, et fondu croisé avec ses voisins pendant les transitions.
      const { fadeIn, fadeOut } = trackFades(track, clip);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(fadeIn > 0 ? 0 : level, start);
      if (fadeIn > 0) gain.gain.linearRampToValueAtTime(level, start + fadeIn / 1000);
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(level, end - fadeOut / 1000);
        gain.gain.linearRampToValueAtTime(0, end);
      }
      const node = ctx.createBufferSource();
      node.connect(gain).connect(ctx.destination);
      if (clip.speed !== 1 && stretch) {
        // Passage de la source lu par ce clip, accéléré ou ralenti en gardant la hauteur de la voix.
        const segment = sliceBuffer(ctx, buffer, clip.inPoint / 1000, (clip.duration * clip.speed) / 1000);
        node.buffer = await stretch(segment, clip.speed);
        node.start(start, 0, clip.duration / 1000);
      } else {
        node.buffer = buffer;
        node.playbackRate.value = clip.speed;
        node.start(start, clip.inPoint / 1000, (clip.duration * clip.speed) / 1000);
      }
    }
  }

  signal.throwIfAborted();
  return ctx.startRendering();
}
