export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Remplit tout le cadre avec la source, centrée (les bords qui dépassent sont rognés). */
export function fitCover(srcWidth: number, srcHeight: number, frameWidth: number, frameHeight: number): Rect {
  if (srcWidth <= 0 || srcHeight <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.max(frameWidth / srcWidth, frameHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height };
}

/** Place une source dans le cadre en entier (sans recadrage), centrée. */
export function fitContain(srcWidth: number, srcHeight: number, frameWidth: number, frameHeight: number): Rect {
  if (srcWidth <= 0 || srcHeight <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(frameWidth / srcWidth, frameHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height };
}
