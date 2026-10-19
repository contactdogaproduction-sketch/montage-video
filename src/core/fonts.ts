import type { FontId } from './types';

export interface FontDefinition {
  id: FontId;
  label: string;
  family: string;
  weight: number;
}

/** Les trois polices proposées pour le texte. */
export const FONTS: FontDefinition[] = [
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', weight: 800 },
  { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', weight: 400 },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', weight: 400 },
];

export function fontDefinition(id: FontId): FontDefinition {
  return FONTS.find((f) => f.id === id) ?? (FONTS[0] as FontDefinition);
}

/** Valeur CSS `font` pour le canvas. */
export function cssFont(id: FontId, size: number): string {
  const font = fontDefinition(id);
  return `${font.weight} ${size}px "${font.family}"`;
}
