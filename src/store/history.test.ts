import { describe, expect, it } from 'vitest';
import { createHistory, pushState, redo, undo } from './history';

describe('historique', () => {
  it('annule et rétablit', () => {
    let h = createHistory(1);
    h = pushState(h, 2);
    h = pushState(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(h.future).toEqual([3]);
  });
  it('vide le futur lors d’une nouvelle action', () => {
    let h = pushState(pushState(createHistory(1), 2), 3);
    h = pushState(undo(h), 4);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([1, 2]);
  });
  it('ignore un état identique', () => {
    const h = createHistory({ a: 1 });
    expect(pushState(h, h.present)).toBe(h);
  });
  it('ne fait rien sans passé ou sans futur', () => {
    const h = createHistory(1);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
  it('limite la taille de l’historique', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = pushState(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
  });
});
