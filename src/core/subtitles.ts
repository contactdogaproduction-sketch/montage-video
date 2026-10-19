import { CENTERED, IMAGE_DEFAULT_DURATION } from './clip';
import { createTrack, pruneEmptyTracks } from './project';
import type { Ms, Project, TextClip } from './types';

/** Passage transcrit, avec ses temps sur la timeline (ms). */
export interface TranscriptChunk {
  text: string;
  start: Ms;
  end: Ms;
}

export interface SubtitleSegment {
  text: string;
  start: Ms;
  end: Ms;
}

export interface SegmentOptions {
  /** Nombre maximal de mots par sous-titre. */
  maxWords: number;
  /** Durée maximale d'un sous-titre. */
  maxDuration: Ms;
  /** Durée minimale d'affichage (lisibilité). */
  minDuration: Ms;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = { maxWords: 5, maxDuration: 2500, minDuration: 700 };

/** Retire les annotations de Whisper (« [Musique] », « (rires) », « ♪ ») et les espaces superflus. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phrases que Whisper « invente » sur les silences ou la musique (crédits de sous-titrage appris
 * sur des vidéos en ligne). Elles ne sont jamais réellement prononcées dans un Reel.
 */
const HALLUCINATIONS = [/amara\.org/i, /sous-titr(age|es?)\s+(st|réalisés|par|fait)/i, /société radio-canada/i, /^sous-titrage/i];

export function isHallucination(text: string): boolean {
  return HALLUCINATIONS.some((pattern) => pattern.test(text));
}

/** Retire les passages inventés et les répétitions à l'identique d'un passage au suivant. */
export function filterTranscript(chunks: TranscriptChunk[]): TranscriptChunk[] {
  const kept: TranscriptChunk[] = [];
  for (const chunk of chunks) {
    const text = cleanTranscript(chunk.text);
    if (!text || isHallucination(text)) continue;
    const previous = kept[kept.length - 1];
    if (previous && cleanTranscript(previous.text).toLowerCase() === text.toLowerCase()) continue;
    kept.push(chunk);
  }
  return kept;
}

const SENTENCE_END = /[.!?…]$/;
const PAUSE = /[,;:]$/;

/**
 * Découpe la transcription en sous-titres courts, faciles à lire sur téléphone.
 * Le temps de chaque passage est réparti entre ses mots selon leur longueur ; un sous-titre
 * s'arrête à la fin d'une phrase, à une pause (virgule) s'il a déjà 3 mots, ou aux limites fixées.
 */
export function segmentTranscript(chunks: TranscriptChunk[], options: SegmentOptions = DEFAULT_SEGMENT_OPTIONS): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  for (const chunk of filterTranscript(chunks)) {
    const words = cleanTranscript(chunk.text).split(' ').filter(Boolean);
    if (words.length === 0 || chunk.end <= chunk.start) continue;
    const totalChars = words.reduce((sum, w) => sum + w.length + 1, 0);
    const msPerChar = (chunk.end - chunk.start) / totalChars;

    let current: string[] = [];
    let currentStart = chunk.start;
    let cursor = chunk.start;
    const flush = (end: Ms) => {
      if (current.length === 0) return;
      segments.push({ text: current.join(' '), start: Math.round(currentStart), end: Math.round(end) });
      current = [];
      currentStart = end;
    };
    for (const word of words) {
      const wordEnd = cursor + (word.length + 1) * msPerChar;
      if (current.length > 0 && (current.length >= options.maxWords || wordEnd - currentStart > options.maxDuration)) flush(cursor);
      current.push(word);
      cursor = wordEnd;
      if (SENTENCE_END.test(word) || (PAUSE.test(word) && current.length >= 3)) flush(cursor);
    }
    flush(chunk.end);
  }
  return enforceTiming(segments, options.minDuration);
}

/** Durée minimale d'affichage sans chevauchement : un sous-titre court déborde sur le silence suivant. */
function enforceTiming(segments: SubtitleSegment[], minDuration: Ms): SubtitleSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  return sorted.map((segment, i) => {
    const next = sorted[i + 1];
    const limit = next ? next.start : Infinity;
    const end = Math.min(Math.max(segment.end, segment.start + minDuration), limit);
    return { ...segment, end: Math.max(end, segment.start + 1) };
  });
}

/** Sous-titre style Reels : gros, blanc, contour noir, centré en bas du cadre. */
export function createSubtitleClip(id: string, segment: SubtitleSegment): TextClip {
  return {
    type: 'text',
    id,
    start: segment.start,
    duration: Math.max(1, segment.end - segment.start) || IMAGE_DEFAULT_DURATION,
    text: segment.text,
    style: { font: 'montserrat', size: 84, color: '#ffffff', strokeColor: '#000000', strokeWidth: 10 },
    transform: { ...CENTERED, y: 0.8 },
    keyframes: [],
    animationIn: 'none',
    animationOut: 'none',
    subtitle: true,
  };
}

export function hasSubtitles(project: Project): boolean {
  return project.tracks.some((t) => t.clips.some((c) => c.type === 'text' && c.subtitle));
}

/**
 * Remplace les sous-titres générés précédemment par les nouveaux, sur une piste texte dédiée
 * (les textes ajoutés à la main ne sont jamais touchés).
 */
export function applySubtitles(project: Project, segments: SubtitleSegment[], trackId: string, createId: () => string): Project {
  const cleaned = pruneEmptyTracks({
    ...project,
    tracks: project.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !(c.type === 'text' && c.subtitle)) })),
  });
  if (segments.length === 0) return cleaned;
  const track = { ...createTrack(trackId, 'text'), clips: segments.map((s) => createSubtitleClip(createId(), s)) };
  return { ...cleaned, tracks: [...cleaned.tracks, track] };
}
