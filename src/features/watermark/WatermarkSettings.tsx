import { DEFAULT_WATERMARK, WATERMARK_CORNERS, WATERMARK_LABELS } from '../../core/watermark';
import type { WatermarkCorner } from '../../core/types';
import { logoUrl } from '../../engine/logo';
import { useProject, useProjectStore } from '../../store/projectStore';
import { Segmented } from '../../ui/controls';

const setWatermark = (watermark: WatermarkCorner | null) => useProjectStore.getState().commit((p) => ({ ...p, watermark }));

/** Logo en filigrane sur la vidéo : activé ou non, et dans quel coin (visible aussi dans l'aperçu). */
export function WatermarkSettings() {
  const watermark = useProject().watermark;
  const on = watermark !== null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setWatermark(on ? null : DEFAULT_WATERMARK)}
        className="flex items-center gap-3 text-left text-sm text-neutral-800"
      >
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg bg-neutral-900 object-contain p-1" />
        <span className="flex-1">Mon logo en filigrane</span>
        <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-neutral-300'}`} aria-hidden="true">
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.125rem]' : 'left-0.5'}`} />
        </span>
      </button>
      {watermark && (
        <Segmented
          label="Position"
          value={watermark}
          options={WATERMARK_CORNERS.map((corner) => ({ value: corner, label: WATERMARK_LABELS[corner] }))}
          onChange={setWatermark}
        />
      )}
    </div>
  );
}
