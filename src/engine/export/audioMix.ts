import { getMainTrack, projectDuration } from '../../core/project';
import type { Project } from '../../core/types';
import { getMediaSource } from '../../store/mediaRegistry';

export const EXPORT_SAMPLE_RATE = 48000;

/** Mixe le son de tous les clips vidéo du projet (silence si aucun n'a de piste audio). */
export async function mixProjectAudio(project: Project, signal: AbortSignal): Promise<AudioBuffer> {
  const seconds = projectDuration(project) / 1000;
  const length = Math.max(1, Math.ceil(seconds * EXPORT_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(2, length, EXPORT_SAMPLE_RATE);
  const decoded = new Map<string, AudioBuffer | null>();

  for (const clip of getMainTrack(project).clips) {
    signal.throwIfAborted();
    const media = project.media[clip.mediaId];
    if (media?.kind !== 'video') continue;
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
    if (!buffer) continue;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start(clip.start / 1000, clip.inPoint / 1000, clip.duration / 1000);
  }

  signal.throwIfAborted();
  return ctx.startRendering();
}
