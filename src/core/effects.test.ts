import { describe, expect, it } from 'vitest';
import { TEXT_ANIMATION_MS, animatedTextTransform } from './animation';
import { clipGainAt, effectiveFades } from './audio';
import { cssFont } from './fonts';
import { snapMove, snapPoints, snapValue } from './snap';
import { addMedia, createProject, placeClip } from './project';
import { VIDEO, mediaClip, stickerClip, textClip } from './testUtils';

describe('aimantation', () => {
  it('liste le début, le curseur et les bords des autres clips', () => {
    let p = addMedia(createProject('p'), [VIDEO]);
    p = placeClip(p, stickerClip('a', { start: 1000, duration: 2000 }), 'S');
    p = placeClip(p, stickerClip('b', { start: 5000, duration: 1000 }), 'S');
    expect(snapPoints(p, 'b', 4200).sort((x, y) => x - y)).toEqual([0, 1000, 3000, 4200]);
  });
  it('choisit le point le plus proche dans le seuil', () => {
    expect(snapValue(1040, [0, 1000, 1100], 100)).toBe(1000);
    expect(snapValue(1500, [0, 1000], 100)).toBeNull();
  });
  it('aimante le début ou la fin selon le plus proche', () => {
    expect(snapMove(1030, 500, [1000, 2000], 100)).toEqual({ start: 1000, snappedTo: 1000 });
    expect(snapMove(1480, 500, [1000, 2000], 100)).toEqual({ start: 1500, snappedTo: 2000 });
    expect(snapMove(1300, 500, [1000, 2000], 100)).toEqual({ start: 1300, snappedTo: null });
  });
});

describe('animations du texte', () => {
  const t = textClip('t', { start: 1000, duration: 3000, animationIn: 'zoom', animationOut: 'slide' });
  it('part de la moitié de la taille et transparent pour le zoom d’entrée', () => {
    expect(animatedTextTransform(t, 1000)).toMatchObject({ scale: 0.5, opacity: 0 });
  });
  it('n’altère rien au milieu du clip', () => {
    expect(animatedTextTransform(t, 2500)).toEqual(t.transform);
  });
  it('glisse vers le bas en sortie', () => {
    const end = animatedTextTransform(t, 4000);
    expect(end.y).toBeCloseTo(0.58);
    expect(end.opacity).toBe(0);
    expect(animatedTextTransform(t, 4000 - TEXT_ANIMATION_MS).y).toBe(0.5);
  });
  it('raccourcit l’animation sur un clip très court', () => {
    const short = textClip('s', { start: 0, duration: 400, animationIn: 'fade' });
    expect(animatedTextTransform(short, 200).opacity).toBe(1);
  });
});

describe('audio', () => {
  it('multiplie volume de piste, volume du clip et fondus', () => {
    const c = mediaClip('c', { start: 1000, duration: 4000, volume: 1.5, fadeIn: 1000, fadeOut: 2000 });
    expect(clipGainAt(c, 1, 1500)).toBeCloseTo(0.75);
    expect(clipGainAt(c, 0.5, 2500)).toBeCloseTo(0.75);
    expect(clipGainAt(c, 1, 4000)).toBeCloseTo(0.75);
    expect(clipGainAt(c, 1, 6000)).toBe(0);
  });
  it('réduit les fondus qui dépassent la durée du clip', () => {
    expect(effectiveFades(mediaClip('c', { duration: 1000, fadeIn: 1500, fadeOut: 500 }))).toEqual({ fadeIn: 750, fadeOut: 250 });
  });
});

describe('polices', () => {
  it('construit la police du canvas', () => {
    expect(cssFont('montserrat', 96)).toBe('800 96px "Montserrat"');
    expect(cssFont('pacifico', 40)).toBe('400 40px "Pacifico"');
  });
});
