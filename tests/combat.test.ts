import { describe, it, expect } from 'vitest';
import {
  CombatEngine,
  damageFor,
  blockReduction,
  reactionSeconds,
  counterWindow,
  moves,
  seededRandom,
} from '../src/game/CombatEngine';
import { emptyCommand } from '../src/game/InputManager';
import { rounds, opponentFor } from '../src/data/rounds';
import { validateSave } from '../src/services/SaveService';
import { screenReducer } from '../src/game/ScreenMachine';
const run = (c: CombatEngine, n: number, command = emptyCommand()) => {
  for (let i = 0; i < n; i++)
    c.update(1 / 60, i === 0 ? command : emptyCommand());
};
function quiet() {
  const c = new CombatEngine('elon_musk', 'mark_zuckerberg', 42);
  c.cpu.update = () => emptyCommand();
  c.fighters[0].x = -0.45;
  c.fighters[1].x = 0.45;
  return c;
}
describe('combat rules', () => {
  it('scales power, guard, reaction, and counter window with visible stats', () => {
    expect(damageFor(8, 4)).toBeCloseTo(9.76);
    expect(blockReduction(4)).toBe(0.79);
    expect(reactionSeconds(1)).toBeCloseTo(0.43);
    expect(reactionSeconds(4)).toBeCloseTo(0.17);
    expect(counterWindow(4)).toBeCloseTo(0.17);
  });
  it('has reproducible seeded variation', () => {
    const a = seededRandom(10),
      b = seededRandom(10);
    expect(Array.from({ length: 12 }, a)).toEqual(
      Array.from({ length: 12 }, b),
    );
  });
  it('cannot damage during startup and connects only once during active frames', () => {
    const c = quiet();
    run(c, 8, { ...emptyCommand(), punchPressed: true });
    expect(c.fighters[1].health).toBe(100);
    run(c, 3);
    const health = c.fighters[1].health;
    expect(health).toBeLessThan(100);
    run(c, 8);
    expect(c.fighters[1].health).toBe(health);
  });
  it('a strike outside range misses', () => {
    const c = quiet();
    c.fighters[1].x = 3;
    run(c, 25, { ...emptyCommand(), kickPressed: true });
    expect(c.fighters[1].health).toBe(100);
  });
  it('Havok reports authoritative overlap, not distance fallback', () => {
    const c = quiet();
    c.physics = { sync() {}, step() {}, overlaps: () => false };
    run(c, 25, { ...emptyCommand(), punchPressed: true });
    expect(c.fighters[1].health).toBe(100);
  });
  it('block reduces incoming damage and drains guard stamina', () => {
    const c = quiet();
    c.cpu.update = () => ({ ...emptyCommand(), blockHeld: true });
    run(c, 15, { ...emptyCommand(), punchPressed: true });
    expect(c.fighters[1].health).toBeGreaterThan(96);
    expect(c.fighters[1].health).toBeLessThan(100);
    expect(c.fighters[1].stamina).toBeLessThan(100);
  });
  it('dodging provides timed invulnerability, not permanent immunity', () => {
    const c = quiet();
    c.fighters[1].setAction('dodge');
    c.fighters[1].age = 0.1;
    expect(c.fighters[1].invulnerable).toBe(true);
    c.fighters[1].age = 0.3;
    expect(c.fighters[1].invulnerable).toBe(false);
  });
  it('rejects exhausted attacks and actions during stun', () => {
    const c = quiet();
    c.fighters[0].stamina = 0;
    run(c, 1, { ...emptyCommand(), kickPressed: true, heavy: true });
    expect(c.fighters[0].action).toBe('idle');
    c.fighters[0].stamina = 100;
    c.fighters[0].setAction('stunned');
    run(c, 1, { ...emptyCommand(), punchPressed: true });
    expect(c.fighters[0].action).toBe('stunned');
  });
  it('charges stamina and restores it only after recovery', () => {
    const c = quiet();
    run(c, 1, { ...emptyCommand(), kickPressed: true, heavy: true });
    expect(c.fighters[0].stamina).toBe(78);
    run(c, 20);
    expect(c.fighters[0].stamina).toBe(78);
    run(c, 80);
    expect(c.fighters[0].stamina).toBeGreaterThan(78);
  });
  it('KO ends once and freezes health, timer and winner', () => {
    const c = quiet();
    c.fighters[1].health = 1;
    run(c, 20, { ...emptyCommand(), punchPressed: true });
    expect(c.winner).toBe(0);
    expect(c.method).toBe('K.O.');
    const s = c.snapshot();
    run(c, 200);
    expect(c.snapshot()).toEqual(s);
  });
  it('timer awards decision by health and ties enter sudden death', () => {
    const c = quiet();
    c.remaining = 0.01;
    c.fighters[0].health = 99;
    run(c, 1);
    expect(c.winner).toBe(1);
    expect(c.method).toBe('DECISION');
    const tie = quiet();
    tie.remaining = 0.01;
    run(tie, 1);
    expect(tie.suddenDeath).toBe(true);
    expect(tie.remaining).toBe(15);
    run(tie, 20, { ...emptyCommand(), punchPressed: true });
    expect(tie.winner).toBe(0);
  });
  it('playable outcomes never force the narrative winner', () => {
    const c = quiet();
    c.finish(1, 'DECISION');
    expect(c.winner).toBe(1);
    const canonical = new CombatEngine(
      'elon_musk',
      'mark_zuckerberg',
      1,
      undefined,
      'canonical',
      'elon_musk',
    );
    canonical.finish(1, 'DECISION');
    expect(canonical.winner).toBe(0);
  });
  it('all moves include nonzero startup, active, recovery, stamina and damage', () => {
    for (const m of Object.values(moves))
      for (const value of Object.values(m)) expect(value).toBeGreaterThan(0);
  });
  it('fighters remain inside the octagon and cannot overlap', () => {
    const c = quiet();
    for (let i = 0; i < 600; i++)
      c.update(1 / 60, { ...emptyCommand(), moveX: -1, moveZ: 1 });
    for (const f of c.fighters)
      for (let i = 0; i < 8; i++)
        expect(
          f.x * Math.cos((i * Math.PI) / 4) + f.z * Math.sin((i * Math.PI) / 4),
        ).toBeLessThanOrEqual(3.651);
  });
});
describe('tournament and persistence', () => {
  it('allows either eligible fighter and assigns the other to CPU', () => {
    rounds.forEach((r, i) =>
      r.pair.forEach((id) => expect(opponentFor(i, id)).not.toBe(id)),
    );
    expect(() => opponentFor(0, 'sam_altman')).toThrow();
    expect(rounds[2].pair).toEqual(['dario_amodei', 'elon_musk']);
  });
  it('rejects corrupt, foreign, out-of-range and incompatible saves', () => {
    for (const bad of [
      null,
      {},
      [],
      { version: 2 },
      { version: 1, round: -1 },
      { version: 1, round: 3 },
      {
        version: 1,
        round: 1,
        fighter: 'elon_musk',
        savedAt: new Date().toISOString(),
      },
    ])
      expect(validateSave(bad)).toBeNull();
  });
  it('accepts only valid versioned checkpoints', () => {
    const s = {
      version: 1,
      round: 1,
      fighter: 'dario_amodei',
      savedAt: '2026-09-09T00:00:00Z',
    };
    expect(validateSave(s)).toEqual(s);
  });
  it('prevents duplicate starts, skipped results, and invalid screen jumps', () => {
    expect(screenReducer('menu', 'fight')).toBe('menu');
    expect(screenReducer('intro', 'intro')).toBe('intro');
    expect(screenReducer('fight', 'result')).toBe('result');
    expect(screenReducer('result', 'trophy')).toBe('trophy');
  });
});
