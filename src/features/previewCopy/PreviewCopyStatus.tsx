import { usePreviewCopyStore } from './previewCopies';

/** Indique qu'une vidéo est en cours d'allègement pour l'aperçu (lecture plus fluide une fois terminé). */
export function PreviewCopyStatus() {
  const remaining = usePreviewCopyStore((s) => s.remaining);
  const progress = usePreviewCopyStore((s) => s.progress);
  if (remaining === 0) return null;
  const others = remaining > 1 ? ` (+${remaining - 1})` : '';
  return (
    <span
      className="truncate text-xs text-neutral-500"
      role="status"
      title="Une copie légère de vos vidéos est préparée pour une lecture fluide. L’export utilise toujours les vidéos d’origine."
    >
      Allègement de l’aperçu… {Math.round(progress * 100)} %{others}
    </span>
  );
}
