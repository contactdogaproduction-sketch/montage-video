import { FONTS } from '../../core/fonts';
import type { TextAnimation, TextClip } from '../../core/types';
import { editText, editTransform } from '../../store/editClip';
import { ColorField, Segmented, Slider, TextAreaField } from '../../ui/controls';
import { TransformFields } from '../../ui/TransformFields';
import { ClipTiming } from '../timeline/ClipTiming';

const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'Aucune' },
  { value: 'fade', label: 'Apparition' },
  { value: 'slide', label: 'Glissement' },
  { value: 'zoom', label: 'Zoom' },
];

export function TextPanel({ clip }: { clip: TextClip }) {
  const style = (update: Partial<TextClip['style']>) => editText(clip.id, (c) => ({ ...c, style: { ...c.style, ...update } }));

  return (
    <>
      <TextAreaField label="Texte" value={clip.text} onChange={(text) => editText(clip.id, (c) => ({ ...c, text }))} />
      <Segmented
        label="Police"
        value={clip.style.font}
        options={FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.family, fontWeight: f.weight } }))}
        onChange={(font) => style({ font })}
      />
      <Slider label="Taille du texte" value={clip.style.size} min={32} max={240} step={2} format={(v) => `${v} px`} onChange={(size) => style({ size })} />
      <ColorField label="Couleur" value={clip.style.color} onChange={(color) => style({ color })} />
      <ColorField label="Couleur du contour" value={clip.style.strokeColor} onChange={(strokeColor) => style({ strokeColor })} />
      <Slider
        label="Épaisseur du contour"
        value={clip.style.strokeWidth}
        min={0}
        max={24}
        step={1}
        format={(v) => (v === 0 ? 'Aucun' : `${v} px`)}
        onChange={(strokeWidth) => style({ strokeWidth })}
      />
      <TransformFields transform={clip.transform} onChange={(update) => editTransform(clip.id, update)} />
      <Segmented label="Animation d’entrée" value={clip.animationIn} options={ANIMATIONS} onChange={(animationIn) => editText(clip.id, (c) => ({ ...c, animationIn }))} />
      <Segmented label="Animation de sortie" value={clip.animationOut} options={ANIMATIONS} onChange={(animationOut) => editText(clip.id, (c) => ({ ...c, animationOut }))} />
      <ClipTiming clip={clip} />
    </>
  );
}
