import { LayersIcon } from '../../ui/icons';
import { FilePickerButton } from '../import/ImportButton';
import { ACCEPT_VISUAL } from '../import/readMedia';

/** Incrustation : une vidéo ou une photo par-dessus la vidéo principale, au curseur. */
export function OverlayButton() {
  return (
    <FilePickerButton
      icon={<LayersIcon />}
      label="Incrustation"
      title="Ajouter une vidéo ou une photo en incrustation au curseur"
      accept={ACCEPT_VISUAL}
      destination="overlay"
    />
  );
}
