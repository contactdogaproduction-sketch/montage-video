import { createClip } from '../../core/clip';
import { addMedia, getMainTrack, replaceTrack } from '../../core/project';
import { appendClips } from '../../core/track';
import type { MediaInfo } from '../../core/types';
import { createId } from '../../store/createId';
import { registerMedia } from '../../store/mediaRegistry';
import { useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';
import { readMedia } from './readMedia';

/** Importe les fichiers et les ajoute à la fin de la piste principale (une seule étape d'annulation). */
export async function importFiles(files: File[]): Promise<void> {
  const imported: MediaInfo[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    const id = createId();
    try {
      const { info, url, thumbnail } = await readMedia(file, id);
      registerMedia(id, { file, url, thumbnail });
      imported.push(info);
    } catch {
      rejected.push(file.name);
    }
  }

  if (rejected.length > 0) {
    notify(`Impossible de lire : ${rejected.join(', ')}. Formats acceptés : vidéos et photos lisibles par ce navigateur.`);
  }
  if (imported.length === 0) return;

  useProjectStore.getState().commit((project) => {
    const main = getMainTrack(project);
    const clips = imported.map((media) => createClip(createId(), media, 0));
    return replaceTrack(addMedia(project, imported), appendClips(main, clips));
  });
}
