import { CENTERED, createStickerClip, createTextClip } from './clip';
import type { MediaClip, MediaInfo, StickerClip, TextClip, Track, TrackKind } from './types';

/** Fabriques de données pour les tests. */
export const VIDEO: MediaInfo = { id: 'v', kind: 'video', name: 'v.mp4', duration: 10000, width: 1920, height: 1080 };
export const IMAGE: MediaInfo = { id: 'i', kind: 'image', name: 'i.png', duration: null, width: 800, height: 800 };
export const AUDIO: MediaInfo = { id: 'a', kind: 'audio', name: 'a.mp3', duration: 20000, width: 0, height: 0 };

export function mediaClip(id: string, over: Partial<MediaClip> = {}): MediaClip {
  return {
    type: 'media',
    id,
    mediaId: 'v',
    start: 0,
    inPoint: 0,
    duration: 1000,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform: CENTERED,
    keyframes: [],
    transition: null,
    speed: 1,
    fit: 'contain',
    ...over,
  };
}

export function textClip(id: string, over: Partial<TextClip> = {}): TextClip {
  return { ...createTextClip(id, 0), ...over };
}

export function stickerClip(id: string, over: Partial<StickerClip> = {}): StickerClip {
  return { ...createStickerClip(id, 0, { kind: 'emoji', emoji: '🔥' }), ...over };
}

export function track(id: string, kind: TrackKind, clips: Track['clips'] = []): Track {
  return { id, kind, clips, volume: 1, magnetic: kind === 'main' };
}
