import type { Ms } from './types';

/** Format « mm:ss.d » (dixièmes de seconde). */
export function formatTime(ms: Ms): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

/** Format court pour les graduations de la règle : « 0:05 », « 1:30 », « 0:02.5 ». */
export function formatRulerLabel(ms: Ms): string {
  const totalTenths = Math.round(Math.max(0, ms) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  const base = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return tenths === 0 ? base : `${base}.${tenths}`;
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Nom par défaut d'un nouveau projet : « Projet du 19 oct., 22:30 ». */
export function defaultProjectName(date: Date): string {
  return `Projet du ${dateFormat.format(date)}`;
}

/** Date de modification lisible : « 19 oct., 22:30 ». */
export function formatDate(timestamp: number): string {
  return dateFormat.format(new Date(timestamp));
}

const RULER_STEPS_MS: Ms[] = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];

/** Plus petit pas de graduation laissant au moins `minSpacingPx` pixels entre deux graduations. */
export function rulerStep(pxPerSecond: number, minSpacingPx = 60): Ms {
  for (const step of RULER_STEPS_MS) {
    if ((step / 1000) * pxPerSecond >= minSpacingPx) return step;
  }
  return RULER_STEPS_MS[RULER_STEPS_MS.length - 1] ?? 60000;
}
