import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { findClipLocation } from '../../core/project';
import type { TextClip } from '../../core/types';
import { editText } from '../../store/editClip';
import { useEditorStore } from '../../store/editorStore';
import { getProject } from '../../store/projectStore';

/** Texte (ou sous-titre) en cours de modification directement dans la timeline. */
export const useInlineEditStore = create<{ editingId: string | null; setEditing: (id: string | null) => void }>()((set) => ({
  editingId: null,
  setEditing: (editingId) => set({ editingId }),
}));

/** Ouvre la modification d'un texte dans la piste et place le curseur dessus (l'aperçu le montre). */
export function startInlineEdit(clip: TextClip): void {
  const editor = useEditorStore.getState();
  editor.setPlaying(false);
  editor.select(clip.id);
  editor.setPlayhead(clip.start + Math.min(100, clip.duration / 2));
  useInlineEditStore.getState().setEditing(clip.id);
}

/** Texte suivant sur la même piste (correction des sous-titres à la chaîne). */
function nextTextClip(clipId: string): TextClip | undefined {
  const location = findClipLocation(getProject(), clipId);
  if (!location) return undefined;
  return location.track.clips.find((c): c is TextClip => c.type === 'text' && c.start > location.clip.start);
}

interface InlineTextEditorProps {
  clip: TextClip;
  left: number;
  width: number;
}

/**
 * Champ posé sur le clip dans la timeline. Entrée : valide et passe au texte suivant de la piste ;
 * Maj+Entrée : retour à la ligne ; Échap : annule. Chaque texte validé = une étape d'annulation.
 */
export function InlineTextEditor({ clip, left, width }: InlineTextEditorProps) {
  const [value, setValue] = useState(clip.text);
  const done = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    if (done.current) return;
    done.current = true;
    if (value.trim() !== '' && value !== clip.text) editText(clip.id, (c) => ({ ...c, text: value }));
  };

  const close = () => useInlineEditStore.getState().setEditing(null);

  return (
    <textarea
      ref={inputRef}
      value={value}
      rows={1}
      aria-label="Modifier le texte"
      onChange={(e) => setValue(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        save();
        if (useInlineEditStore.getState().editingId === clip.id) close();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          done.current = true;
          close();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          save();
          const next = nextTextClip(clip.id);
          if (next) startInlineEdit(next);
          else close();
        }
      }}
      className="absolute inset-y-0.5 z-40 resize-none overflow-hidden rounded-lg border-2 border-accent bg-white px-2 py-1 text-sm leading-tight text-neutral-900 shadow-lg focus:outline-none"
      style={{ left, width: Math.max(width, 220) }}
    />
  );
}
