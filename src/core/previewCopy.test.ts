import { describe, expect, it } from 'vitest';
import { previewCopySize } from './previewCopy';

describe('copie allégée pour l’aperçu', () => {
  it('réduit une vidéo 4K ou 1080p de téléphone en 720p, en gardant les proportions', () => {
    expect(previewCopySize(2160, 3840, 30)).toEqual({ width: 720, height: 1280 });
    expect(previewCopySize(1080, 1920, 30)).toEqual({ width: 720, height: 1280 });
    expect(previewCopySize(3840, 2160, 60)).toEqual({ width: 1280, height: 720 });
  });
  it('garde des dimensions paires', () => {
    expect(previewCopySize(1440, 1920, 30)).toEqual({ width: 960, height: 1280 });
    expect(previewCopySize(1000, 1999, 30)).toEqual({ width: 640, height: 1280 });
  });
  it('allège une petite vidéo à 60 images/s sans l’agrandir', () => {
    expect(previewCopySize(720, 1280, 60)).toEqual({ width: 720, height: 1280 });
  });
  it('laisse telle quelle une vidéo déjà légère', () => {
    expect(previewCopySize(720, 1280, 30)).toBeNull();
    expect(previewCopySize(480, 854, 29.97)).toBeNull();
    expect(previewCopySize(0, 0, 30)).toBeNull();
  });
});
