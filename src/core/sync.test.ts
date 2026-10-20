import { describe, expect, it } from 'vitest';
import { syncDecision } from './sync';

describe('rattrapage des lecteurs', () => {
  it('ne touche à rien quand le lecteur est à l’heure', () => {
    expect(syncDecision(0.03, 1, false)).toEqual({ rate: 1, catchingUp: false, seek: false });
  });
  it('ralentit un lecteur en avance, accélère un lecteur en retard', () => {
    expect(syncDecision(0.3, 1, false)).toEqual({ rate: 0.92, catchingUp: true, seek: false });
    expect(syncDecision(-0.3, 1, false).rate).toBeCloseTo(1.08);
  });
  it('continue le rattrapage jusqu’à un petit écart, sans osciller autour du seuil', () => {
    expect(syncDecision(0.05, 1, true).catchingUp).toBe(true);
    expect(syncDecision(0.05, 1, false).catchingUp).toBe(false);
    expect(syncDecision(0.01, 1, true)).toEqual({ rate: 1, catchingUp: false, seek: false });
  });
  it('repositionne seulement au-delà d’une seconde d’écart', () => {
    expect(syncDecision(0.9, 1, false).seek).toBe(false);
    expect(syncDecision(-1.2, 1, true)).toEqual({ rate: 1, catchingUp: false, seek: true });
  });
  it('tient compte de la vitesse du clip', () => {
    // À 2x, la source avance deux fois plus vite : l'écart toléré est doublé.
    expect(syncDecision(1.5, 2, false)).toEqual({ rate: 1.84, catchingUp: true, seek: false });
    expect(syncDecision(0.1, 2, false).rate).toBe(2);
  });
});
