import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from 'mediabunny';

/**
 * Son d'un fichier, prêt à être décodé par le navigateur.
 * Pour une vidéo, seule la piste son est recopiée (sans réencodage) dans un petit fichier M4A :
 * décoder la vidéo entière échoue sur iPhone (fichier .MOV de plusieurs centaines de Mo).
 * Renvoie `null` si le fichier n'a pas de son.
 */
export async function extractAudio(file: Blob): Promise<ArrayBuffer | null> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const audio = await input.getPrimaryAudioTrack();
    if (!audio) return null;
    if (!(await input.getPrimaryVideoTrack())) return file.arrayBuffer();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { discard: true },
      audio: {},
      showWarnings: false,
    });
    // Son impossible à recopier tel quel : le fichier entier est essayé.
    if (!conversion.isValid) return file.arrayBuffer();
    await conversion.execute();
    return output.target.buffer ?? file.arrayBuffer();
  } catch {
    // Format inconnu de la bibliothèque : le navigateur essaie le fichier entier.
    return file.arrayBuffer();
  } finally {
    input.dispose();
  }
}
