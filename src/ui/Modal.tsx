import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
}

/** Fenêtre modale : feuille en bas sur mobile, centrée sur ordinateur. */
export function Modal({ title, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
