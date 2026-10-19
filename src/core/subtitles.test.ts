import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import { createProject, placeClip } from './project';
import { applySubtitles, cleanTranscript, hasSubtitles, isHallucination, segmentTranscript } from './subtitles';
import { textClip } from './testUtils';
import type { TextClip } from './types';

describe('nettoyage', () => {
  it('retire les annotations et les espaces en trop', () => {
    expect(cleanTranscript(' [Musique]  Bonjour   à tous (rires) ♪ ')).toBe('Bonjour à tous');
  });
});

describe('découpage en sous-titres', () => {
  it('coupe en groupes de 5 mots maximum et répartit le temps', () => {
    const segments = segmentTranscript([{ text: 'un deux trois quatre cinq six sept', start: 0, end: 2800 }], { maxWords: 5, maxDuration: 10000, minDuration: 0 });
    expect(segments.map((s) => s.text)).toEqual(['un deux trois quatre cinq', 'six sept']);
    expect(segments[0]?.start).toBe(0);
    expect(segments[1]?.end).toBe(2800);
    expect(segments[0]?.end).toBe(segments[1]?.start);
  });
  it('s’arrête en fin de phrase et aux virgules après 3 mots', () => {
    const segments = segmentTranscript([{ text: 'Salut. Aujourd’hui on teste, la nouvelle app', start: 0, end: 4000 }], { maxWords: 5, maxDuration: 10000, minDuration: 0 });
    expect(segments.map((s) => s.text)).toEqual(['Salut.', 'Aujourd’hui on teste,', 'la nouvelle app']);
  });
  it('limite la durée d’un sous-titre', () => {
    const segments = segmentTranscript([{ text: 'mot mot mot mot', start: 0, end: 8000 }], { maxWords: 5, maxDuration: 2500, minDuration: 0 });
    expect(segments.every((s) => s.end - s.start <= 2500)).toBe(true);
    expect(segments).toHaveLength(4);
  });
  it('garantit une durée minimale sans chevaucher le suivant', () => {
    const segments = segmentTranscript(
      [
        { text: 'Oui.', start: 1000, end: 1200 },
        { text: 'Non.', start: 1500, end: 2500 },
      ],
      { maxWords: 5, maxDuration: 2500, minDuration: 700 },
    );
    expect(segments.map((s) => [s.start, s.end])).toEqual([
      [1000, 1500],
      [1500, 2500],
    ]);
  });
  it('ignore les passages vides ou sans durée', () => {
    expect(segmentTranscript([{ text: '[Musique]', start: 0, end: 1000 }, { text: 'mot', start: 500, end: 500 }])).toEqual([]);
  });
});

describe('passages inventés par Whisper', () => {
  it('écarte les crédits de sous-titrage et les répétitions', () => {
    const segments = segmentTranscript(
      [
        { text: 'Bonjour tout le monde.', start: 0, end: 1500 },
        { text: 'Bonjour tout le monde.', start: 1500, end: 3000 },
        { text: 'Sous-titrage ST\' 501', start: 3000, end: 5000 },
        { text: 'Sous-titres réalisés par la communauté d’Amara.org', start: 5000, end: 7000 },
        { text: 'On commence.', start: 7000, end: 8000 },
      ],
      { maxWords: 5, maxDuration: 10000, minDuration: 0 },
    );
    expect(segments.map((s) => s.text)).toEqual(['Bonjour tout le monde.', 'On commence.']);
  });
  it('garde une phrase normale qui parle de sous-titres', () => {
    expect(isHallucination('Activez les sous-titres pour suivre')).toBe(false);
  });
});

describe('application au projet', () => {
  it('remplace les anciens sous-titres sans toucher aux textes ajoutés à la main', () => {
    let p = placeClip(createProject('p'), textClip('manuel', { start: 0 }), 'T');
    let n = 0;
    const id = () => `s${n++}`;
    p = applySubtitles(p, [{ text: 'Bonjour', start: 0, end: 1000 }], 'S1', id);
    expect(hasSubtitles(p)).toBe(true);
    p = applySubtitles(p, [{ text: 'Salut', start: 0, end: 800 }, { text: 'à tous', start: 800, end: 1600 }], 'S2', id);
    expect(p.tracks.map((t) => t.id)).toEqual(['main', 'T', 'S2']);
    const subs = p.tracks[2]?.clips as TextClip[];
    expect(subs.map((c) => [c.text, c.start, c.duration, c.subtitle])).toEqual([
      ['Salut', 0, 800, true],
      ['à tous', 800, 800, true],
    ]);
    expect(subs[0]?.style).toMatchObject({ font: 'montserrat', strokeColor: '#000000', strokeWidth: 10 });
    expect(subs[0]?.transform.y).toBe(0.8);
  });
  it('les textes enregistrés auparavant ne sont pas des sous-titres', () => {
    const p = migrateProject({ id: 'p', tracks: [{ id: 't', kind: 'text', clips: [{ type: 'text', id: 'x', start: 0, duration: 100, text: 'a' }] }] }, 'f');
    expect((p.tracks[1]?.clips[0] as TextClip).subtitle).toBe(false);
  });
});
