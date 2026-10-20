/// <reference lib="webworker" />
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_MEDIUM, canEncodeVideo } from 'mediabunny';
import { PREVIEW_COPY_FPS, PREVIEW_COPY_KEYFRAME_INTERVAL_S, previewCopySize } from '../../core/previewCopy';
import type { CopyRequest, CopyResponse } from './protocol';

/**
 * Conversion d'une vidéo en copie allégée pour l'aperçu, hors de la page (l'interface reste fluide).
 * WebCodecs utilise le décodeur et l'encodeur matériels de l'appareil : bien plus rapide que la lecture.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: CopyResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

async function convert({ id, file }: CopyRequest): Promise<CopyResponse> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return { type: 'unsupported', id };
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) return { type: 'skipped', id };
    const { averagePacketRate } = await video.computePacketStats(120);
    const size = previewCopySize(video.displayWidth, video.displayHeight, averagePacketRate);
    if (!size || !(await canEncodeVideo('avc', size))) return { type: 'skipped', id };
    const audio = await input.getPrimaryAudioTrack();

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        ...size,
        fit: 'contain',
        codec: 'avc',
        frameRate: PREVIEW_COPY_FPS,
        keyFrameInterval: PREVIEW_COPY_KEYFRAME_INTERVAL_S,
        quality: QUALITY_MEDIUM,
        forceTranscode: true,
      },
      // Le son est recopié tel quel (pas de réencodage) quand c'est possible.
      audio: {},
      showWarnings: false,
    });
    // Copie sans son alors que l'original en a : l'aperçu serait muet, on garde l'original.
    const lostAudio = audio !== null && conversion.discardedTracks.some((d) => d.track === audio);
    if (!conversion.isValid || lostAudio) return { type: 'skipped', id };
    conversion.onProgress = (progress) => post({ type: 'progress', id, progress });
    await conversion.execute();
    const data = output.target.buffer;
    return data ? { type: 'done', id, data } : { type: 'skipped', id };
  } catch {
    // Format inconnu ou conversion impossible sur cet appareil : l'original reste utilisé.
    return { type: 'skipped', id };
  } finally {
    input.dispose();
  }
}

scope.onmessage = async (event: MessageEvent<CopyRequest>) => {
  const result = await convert(event.data);
  post(result, result.type === 'done' ? [result.data] : []);
};
