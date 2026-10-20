/**
 * Session audio de l'iPhone (Safari 16.4 et plus) :
 * - `playback` : le son de l'aperçu sort même en mode silencieux ;
 * - `play-and-record` : nécessaire pour enregistrer au micro pendant la lecture (voix off) ;
 *   en `playback`, l'iPhone refuse ou coupe la capture du micro.
 * Sans effet sur les autres navigateurs.
 */
export type AudioSessionType = 'playback' | 'play-and-record';

let recording = false;

function apply(type: AudioSessionType): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = type;
}

/** Lecture de l'aperçu : session de lecture, sauf pendant un enregistrement. */
export function setPlaybackAudioSession(): void {
  if (!recording) apply('playback');
}

/** Début ou fin d'un enregistrement au micro. */
export function setRecordingAudioSession(active: boolean): void {
  recording = active;
  apply(active ? 'play-and-record' : 'playback');
}
