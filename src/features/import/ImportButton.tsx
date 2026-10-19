import { useRef, useState, type ChangeEvent } from 'react';
import { PlusIcon } from '../../ui/icons';
import { ToolButton } from '../../ui/ToolButton';
import { importFiles } from './importFiles';

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    try {
      await importFiles(files);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToolButton
        icon={<PlusIcon />}
        label={busy ? 'Import…' : 'Importer'}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Importer des vidéos et des photos"
      />
      <input ref={inputRef} type="file" accept="video/*,image/*" multiple hidden onChange={onChange} />
    </>
  );
}
