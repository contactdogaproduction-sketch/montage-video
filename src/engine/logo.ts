import logoUrl from '../assets/logo.png';

/** Logo de l'utilisateur (filigrane des vidéos), chargé une fois. */
let loading: Promise<HTMLImageElement | null> | null = null;

export function loadLogo(): Promise<HTMLImageElement | null> {
  loading ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
  return loading;
}

export { logoUrl };
