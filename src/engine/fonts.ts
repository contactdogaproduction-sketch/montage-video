import '@fontsource/montserrat/800.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/pacifico/400.css';
import { FONTS, cssFont } from '../core/fonts';

let loading: Promise<void> | null = null;

/** Charge les trois polices du texte (fichiers servis par l'application, sans réseau externe). */
export function loadFonts(): Promise<void> {
  loading ??= Promise.all(FONTS.map((f) => document.fonts.load(cssFont(f.id, 40), 'AÉé'))).then(() => undefined);
  return loading;
}
