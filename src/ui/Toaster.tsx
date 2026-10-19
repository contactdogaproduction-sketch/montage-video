import { useNoticeStore } from './notify';

export function Toaster() {
  const notices = useNoticeStore((s) => s.notices);
  const dismiss = useNoticeStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {notices.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => dismiss(n.id)}
          className="pointer-events-auto max-w-md rounded-xl bg-neutral-900 px-4 py-3 text-left text-sm text-white shadow-lg"
        >
          {n.message}
        </button>
      ))}
    </div>
  );
}
