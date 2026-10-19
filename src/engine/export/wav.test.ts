import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('écrit un en-tête WAV et des échantillons 16 bits entrelacés', () => {
    const left = new Float32Array([0, 1, -1]);
    const right = new Float32Array([0.5, 2, -2]);
    const bytes = encodeWav({
      numberOfChannels: 2,
      sampleRate: 48000,
      length: 3,
      getChannelData: (c) => (c === 0 ? left : right),
    });
    const view = new DataView(bytes.buffer);
    const text = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(12);
    expect(bytes.length).toBe(56);
    const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 16383, 32767, 32767, -32768, -32768]);
  });
});
