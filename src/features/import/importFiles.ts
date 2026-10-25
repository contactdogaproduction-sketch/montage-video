import { CENTERED, createMediaClip } from '../../core/clip';
import { addMedia, getMainTrack, placeClip, replaceTrack } from '../../core/project';
import { appendClips } from '../../core/track';
import type { MediaInfo, Project } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { registerMedia } from '../../store/mediaRegistry';
import { useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';
import { readMedia } from './readMedia';

/** Échelle d'une incrustation à son ajout (moitié de la taille du cadre). */
const OVERLAY_SCALE = 0.5;

/** Fichiers lus en même temps (la lecture attend surtout le stockage de l'appareil). */
const PARALLEL_READS = 3;

/** Lit et enregistre les fichiers (plusieurs à la fois, dans l'ordre choisi) ; signale ceux que le navigateur ne sait pas lire. */
export async function loadMediaFiles(files: File[]): Promise<MediaInfo[]> {
  const results: (MediaInfo | null)[] = files.map(() => null);
  const rejected: string[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const file = files[index];
      if (!file) continue;
      const id = createId();
      try {
        const { info, url, thumbnail } = await readMedia(file, id);
        registerMedia(id, { file, url, thumbnail });
        results[index] = info;
      } catch {
        rejected.push(file.name);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, files.length) }, worker));
  const loaded = results.filter((info): info is MediaInfo => info !== null);
  if (rejected.length > 0) {
    notify(`Impossible de lire : ${rejected.join(', ')}. Formats acceptés : vidéos, photos et fichiers audio lisibles par ce navigateur.`);
  }
  return loaded;
}

/**
 * Destination des vidéos et photos importées :
 * `main` = à la suite sur la piste principale, `overlay` = en incrustation au curseur.
 * Les fichiers audio vont toujours sur une piste audio, au curseur.
 */
export type ImportDestination = 'main' | 'overlay';

/** Importe les fichiers en une seule étape d'annulation et sélectionne le dernier clip ajouté au curseur. */
export async function importFiles(files: File[], destination: ImportDestination): Promise<void> {
  const media = await loadMediaFiles(files);
  if (media.length === 0) return;
  const playhead = useEditorStore.getState().playhead;
  let lastPlaced: string | null = null;

  useProjectStore.getState().commit((initial) => {
    let project: Project = addMedia(initial, media);
    const toMain = media.filter((m) => m.kind !== 'audio' && destination === 'main');
    if (toMain.length > 0) {
      const clips = toMain.map((m) => createMediaClip(createId(), m, 0));
      project = replaceTrack(project, appendClips(getMainTrack(project), clips));
    }
    for (const m of media) {
      if (m.kind !== 'audio' && destination === 'main') continue;
      const transform = m.kind === 'audio' ? CENTERED : { ...CENTERED, scale: OVERLAY_SCALE };
      const clip = createMediaClip(createId(), m, playhead, transform);
      project = placeClip(project, clip, createId());
      lastPlaced = clip.id;
    }
    return project;
  });

  if (lastPlaced) useEditorStore.getState().select(lastPlaced);
}
