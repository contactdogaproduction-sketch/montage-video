import { CENTERED } from './clip';
import { FORMATS, MAIN_TRACK_ID, createProject, createTrack, setProjectFormat } from './project';
import type { Clip, MediaInfo, Project, TextStyle, Track } from './types';

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const DEFAULT_STYLE: TextStyle = { font: 'montserrat', size: 96, color: '#ffffff', strokeColor: '#000000', strokeWidth: 8 };

function migrateClip(raw: Raw): Clip | null {
  const base = { transform: CENTERED, keyframes: [], ...raw };
  switch (raw.type) {
    case 'media':
      return { volume: 1, fadeIn: 0, fadeOut: 0, inPoint: 0, transition: null, speed: 1, fit: 'contain', ...base } as unknown as Clip;
    case 'text':
      return { text: '', animationIn: 'none', animationOut: 'none', ...base, style: { ...DEFAULT_STYLE, ...(isObject(raw.style) ? raw.style : {}) } } as unknown as Clip;
    case 'sticker':
      return isObject(raw.source) ? (base as unknown as Clip) : null;
    default:
      return null;
  }
}

function migrateTrack(raw: Raw): Track {
  const clips = asArray(raw.clips)
    .filter(isObject)
    .map(migrateClip)
    .filter((c): c is Clip => c !== null);
  return { volume: 1, ...raw, clips } as Track;
}

/**
 * Remet à niveau un projet relu depuis la sauvegarde : complète les champs ajoutés par les
 * versions plus récentes de l'application (valeurs par défaut) et garantit une piste principale.
 */
export function migrateProject(raw: unknown, fallbackId: string): Project {
  if (!isObject(raw)) return createProject(fallbackId);
  const defaults = createProject(typeof raw.id === 'string' ? raw.id : fallbackId);
  const tracks = asArray(raw.tracks).filter(isObject).map(migrateTrack);
  if (!tracks.some((t) => t.kind === 'main')) tracks.unshift(createTrack(MAIN_TRACK_ID, 'main'));
  const media = isObject(raw.media) ? (raw.media as Record<string, MediaInfo>) : {};
  const merged = { ...defaults, ...raw, media, tracks } as Project;
  // Format inconnu ou absent (projets d'avant les formats) : vertical ; dimensions toujours cohérentes.
  const format = FORMATS.some((f) => f.format === merged.format) ? merged.format : '9:16';
  return setProjectFormat(merged, format);
}
