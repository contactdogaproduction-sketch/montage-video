import { useRef, useState, type ChangeEvent } from 'react';
import { createStickerClip } from '../../core/clip';
import { addMedia, placeClip } from '../../core/project';
import type { MediaInfo, StickerSource } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore } from '../../store/projectStore';
import { PlusIcon, SmileIcon } from '../../ui/icons';
import { Modal } from '../../ui/Modal';
import { notify } from '../../ui/notify';
import { ToolButton } from '../../ui/ToolButton';
import { loadMediaFiles } from '../import/importFiles';
import { EMOJI_CATEGORIES } from './emojis';

/** Ajoute un sticker au curseur (et son image PNG au projet), en une étape d'annulation. */
function addSticker(source: StickerSource, media?: MediaInfo): void {
  const editor = useEditorStore.getState();
  const clip = createStickerClip(createId(), Math.round(editor.playhead), source);
  useProjectStore.getState().commit((project) => placeClip(media ? addMedia(project, [media]) : project, clip, createId()));
  editor.select(clip.id);
}

/** Bibliothèque de stickers : emojis intégrés ou PNG transparent importé. */
export function StickerButton() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (source: StickerSource, media?: MediaInfo) => {
    addSticker(source, media);
    setOpen(false);
  };

  const onPng = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const media = (await loadMediaFiles(files)).filter((m) => m.kind === 'image');
    if (files.length > 0 && media.length === 0) notify('Choisissez une image PNG.');
    const [first] = media;
    if (first) pick({ kind: 'image', mediaId: first.id }, first);
  };

  return (
    <>
      <ToolButton icon={<SmileIcon />} label="Stickers" onClick={() => setOpen(true)} title="Ajouter un sticker au curseur" />
      {open && (
        <Modal title="Stickers">
          <div className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <PlusIcon width={18} height={18} />
              Importer un PNG transparent
            </button>
            <input ref={inputRef} type="file" accept="image/png" hidden onChange={onPng} />
            {EMOJI_CATEGORIES.map((category) => (
              <section key={category.label}>
                <h3 className="mb-2 text-xs font-medium text-neutral-500">{category.label}</h3>
                <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
                  {category.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Sticker ${emoji}`}
                      onClick={() => pick({ kind: 'emoji', emoji })}
                      className="rounded-xl py-2 text-3xl hover:bg-neutral-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100">
            Fermer
          </button>
        </Modal>
      )}
    </>
  );
}
