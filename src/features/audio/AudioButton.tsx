import { MusicIcon } from '../../ui/icons';
import { FilePickerButton } from '../import/ImportButton';
import { ACCEPT_AUDIO } from '../import/readMedia';

/** Ajoute un ou plusieurs fichiers audio au curseur, sur une piste audio. */
export function AudioButton() {
  return <FilePickerButton icon={<MusicIcon />} label="Audio" title="Ajouter un fichier audio au curseur" accept={ACCEPT_AUDIO} destination="main" />;
}
