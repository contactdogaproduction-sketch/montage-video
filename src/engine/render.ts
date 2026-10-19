import { fitContain } from '../core/geometry';
import { getMainTrack } from '../core/project';
import { findClipAt } from '../core/track';
import type { Clip, MediaInfo, Ms, Project } from '../core/types';

/** Fournit l'image source d'un clip (élément vidéo positionné, image chargée), ou `null` si indisponible. */
export type SourceResolver = (clip: Clip, media: MediaInfo) => CanvasImageSource | null;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Dessine l'image du projet au temps `t`, dans le repère du projet (width × height).
 * Partagé par l'aperçu et l'export : ce qu'on voit est ce qu'on exporte.
 */
export function drawFrame(ctx: Context2D, project: Project, t: Ms, resolve: SourceResolver): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, project.width, project.height);
  const clip = findClipAt(getMainTrack(project), t);
  if (!clip) return;
  const media = project.media[clip.mediaId];
  if (!media) return;
  const source = resolve(clip, media);
  if (!source) return;
  const rect = fitContain(media.width, media.height, project.width, project.height);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}
