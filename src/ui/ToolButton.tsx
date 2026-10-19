import type { ReactNode } from 'react';

interface ToolButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Infobulle (ex. raccourci clavier). */
  title?: string;
}

/** Bouton d'outil : icône au-dessus de son libellé, zone tactile confortable. */
export function ToolButton({ icon, label, onClick, disabled = false, title }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex min-w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:pointer-events-none disabled:opacity-35"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
