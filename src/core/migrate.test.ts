import { describe, expect, it } from 'vitest';
import { CENTERED } from './clip';
import { migrateProject } from './migrate';
import type { MediaClip, TextClip } from './types';

describe('migrateProject', () => {
  it('complète un projet enregistré par une version plus ancienne', () => {
    // Projet tel qu'enregistré avant les keyframes, transitions et volumes.
    const old = {
      id: 'p1',
      name: 'Ancien',
      width: 1080,
      height: 1920,
      fps: 30,
      media: { v: { id: 'v', kind: 'video', name: 'v.mp4', duration: 5000, width: 1920, height: 1080 } },
      tracks: [
        { id: 'main', kind: 'main', clips: [{ type: 'media', id: 'c', mediaId: 'v', start: 0, inPoint: 0, duration: 5000 }] },
        { id: 't', kind: 'text', clips: [{ type: 'text', id: 'x', start: 0, duration: 1000, text: 'Salut', style: { size: 50 } }] },
      ],
    };
    const p = migrateProject(old, 'fallback');
    expect(p.id).toBe('p1');
    expect(p.name).toBe('Ancien');
    expect(p.tracks.map((t) => t.volume)).toEqual([1, 1]);
    expect(p.tracks[0]?.clips[0] as MediaClip).toMatchObject({ volume: 1, fadeIn: 0, fadeOut: 0, transition: null, keyframes: [], transform: CENTERED });
    expect((p.tracks[1]?.clips[0] as TextClip).style).toMatchObject({ size: 50, font: 'montserrat', strokeWidth: 8 });
  });
  it('garde les valeurs présentes', () => {
    const p = migrateProject(
      { id: 'p', tracks: [{ id: 'main', kind: 'main', volume: 0.5, clips: [{ type: 'media', id: 'c', mediaId: 'v', start: 0, inPoint: 200, duration: 100, volume: 2 }] }] },
      'f',
    );
    expect(p.tracks[0]?.volume).toBe(0.5);
    expect(p.tracks[0]?.clips[0]).toMatchObject({ inPoint: 200, volume: 2 });
  });
  it('garantit une piste principale et ignore les clips illisibles', () => {
    const p = migrateProject({ id: 'p', tracks: [{ id: 's', kind: 'sticker', clips: [{ type: 'sticker', id: 's1' }, { type: 'inconnu' }, 42] }] }, 'f');
    expect(p.tracks.map((t) => t.kind)).toEqual(['main', 'sticker']);
    expect(p.tracks[1]?.clips).toEqual([]);
  });
  it('remplace une donnée illisible par un projet vide', () => {
    expect(migrateProject(null, 'nouveau')).toMatchObject({ id: 'nouveau', tracks: [{ kind: 'main', clips: [] }] });
  });
});
