import { encodeWav } from '../../engine/export/wav';

/** Vrai si le navigateur peut utiliser le micro (contexte sécurisé : https ou localhost). */
export function canRecord(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

export interface VoiceRecording {
  /** Arrête l'enregistrement et renvoie la voix en WAV (format lisible et précis partout). */
  stop: () => Promise<File>;
  /** Abandonne l'enregistrement. */
  cancel: () => void;
}

/**
 * Démarre l'enregistrement du micro. Le format natif du navigateur (WebM ou MP4) est converti en
 * WAV à l'arrêt : durée exacte, positionnement précis dans la vidéo, export sans conversion.
 */
export async function startVoiceRecording(name: string): Promise<VoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  recorder.start();

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      release();
      const recorded = new Blob(chunks, { type: recorder.mimeType });
      const decoder = new OfflineAudioContext(1, 1, 48000);
      const audio = await decoder.decodeAudioData(await recorded.arrayBuffer());
      return new File([encodeWav(audio)], `${name}.wav`, { type: 'audio/wav' });
    },
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}
