import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { PlusIcon } from '../../ui/icons';
import { ToolButton } from '../../ui/ToolButton';
import { importFiles, type ImportDestination } from './importFiles';
import { ACCEPT_ALL } from './readMedia';

interface FilePickerButtonProps {
  icon: ReactNode;
  label: string;
  title: string;
  accept: string;
  destination: ImportDestination;
}

/** Bouton d'outil qui ouvre le sélecteur de fichiers de l'appareil puis importe la sélection. */
export function FilePickerButton({ icon, label, title, accept, destination }: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    try {
      await importFiles(files, destination);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToolButton icon={icon} label={busy ? 'Import…' : label} disabled={busy} onClick={() => inputRef.current?.click()} title={title} />
      <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={onChange} />
    </>
  );
}

/** Import général : vidéos et photos à la suite sur la piste principale, audio au curseur. */
export function ImportButton() {
  return (
    <FilePickerButton
      icon={<PlusIcon />}
      label="Importer"
      title="Importer des vidéos, photos et fichiers audio"
      accept={ACCEPT_ALL}
      destination="main"
    />
  );
}
