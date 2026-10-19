import { useState } from 'react';
import { FORMATS, setProjectFormat } from '../../core/project';
import { useProject, useProjectStore } from '../../store/projectStore';
import { Modal } from '../../ui/Modal';
import { ToolButton } from '../../ui/ToolButton';

const RatioIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10v-1h2M17 14v1h-2" />
  </svg>
);

/** Format de la vidéo : 9:16, 1:1 ou 16:9 (export en 1080p). */
export function FormatButton() {
  const project = useProject();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ToolButton icon={<RatioIcon />} label={`Format ${project.format}`} onClick={() => setOpen(true)} title="Changer le format de la vidéo" />
      {open && (
        <Modal title="Format de la vidéo">
          <div className="flex flex-col gap-2">
            {FORMATS.map((f) => {
              const selected = f.format === project.format;
              // Aperçu du cadre, à l'échelle.
              const scale = 40 / Math.max(f.width, f.height);
              return (
                <button
                  key={f.format}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (!selected) useProjectStore.getState().commit((p) => setProjectFormat(p, f.format));
                    setOpen(false);
                  }}
                  className={`flex items-center gap-4 rounded-2xl border px-4 py-3 text-left ${
                    selected ? 'border-accent bg-accent/5' : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <span className={`rounded-sm border-2 ${selected ? 'border-accent' : 'border-neutral-400'}`} style={{ width: f.width * scale, height: f.height * scale }} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-neutral-900">
                      {f.label} · {f.format}
                    </span>
                    <span className="block text-sm text-neutral-500">
                      {f.hint} — {f.width} × {f.height}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Pour recadrer une vidéo, sélectionnez-la puis déplacez-la ou zoomez dans l’aperçu, ou choisissez « Remplir » dans ses réglages.
          </p>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full rounded-2xl px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-100">
            Fermer
          </button>
        </Modal>
      )}
    </>
  );
}
