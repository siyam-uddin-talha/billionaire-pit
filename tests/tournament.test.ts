import { describe, expect, it } from 'vitest';
import { opponentFor, roundPair } from '../src/data/rounds';
import { validateSave } from '../src/services/SaveService';
import type { FighterId } from '../src/data/fighters';

describe('winner-based final', () => {
  for (const first of ['elon_musk', 'mark_zuckerberg'] as FighterId[]) {
    for (const second of ['dario_amodei', 'sam_altman'] as FighterId[]) {
      it(`advances ${second} against ${first} and restores that bracket`, () => {
        const winners = [first, second];
        expect(roundPair(2, winners)).toEqual([second, first]);
        expect(opponentFor(2, second, winners)).toBe(first);
        expect(opponentFor(2, first, winners)).toBe(second);
        const save = {
          version: 1,
          round: 2,
          fighter: second,
          winners,
          savedAt: '2026-09-09T00:00:00Z',
        };
        expect(validateSave(save)).toEqual(save);
      });
    }
  }
  it('rejects a final participant who lost and malformed bracket history', () => {
    const save = {
      version: 1,
      round: 2,
      fighter: 'sam_altman',
      winners: ['mark_zuckerberg', 'sam_altman'],
      savedAt: '2026-09-09T00:00:00Z',
    };
    expect(validateSave({ ...save, fighter: 'dario_amodei' })).toBeNull();
    expect(
      validateSave({ ...save, winners: ['sam_altman', 'mark_zuckerberg'] }),
    ).toBeNull();
    expect(validateSave({ ...save, winners: [] })).toBeNull();
  });
});
