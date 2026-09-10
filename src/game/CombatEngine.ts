import { fighterById, type FighterId } from '../data/fighters';
import { gameRules } from '../data/rounds';
import { emptyCommand, type CombatCommand } from './InputManager';
export type Action =
  | 'idle'
  | 'walk_forward'
  | 'punch_light'
  | 'punch_heavy'
  | 'kick_front'
  | 'kick_power'
  | 'block'
  | 'dodge'
  | 'hit'
  | 'stunned'
  | 'ko'
  | 'victory';
export type Attack =
  | 'punch_light'
  | 'punch_heavy'
  | 'kick_front'
  | 'kick_power';
export const moves: Record<
  Attack,
  {
    startup: number;
    active: number;
    recovery: number;
    damage: number;
    cost: number;
    range: number;
  }
> = {
  punch_light: {
    startup: 0.14,
    active: 0.09,
    recovery: 0.22,
    damage: 8,
    cost: 7,
    range: 1.16,
  },
  punch_heavy: {
    startup: 0.26,
    active: 0.11,
    recovery: 0.42,
    damage: 14,
    cost: 14,
    range: 1.23,
  },
  kick_front: {
    startup: 0.22,
    active: 0.12,
    recovery: 0.35,
    damage: 12,
    cost: 12,
    range: 1.6,
  },
  kick_power: {
    startup: 0.38,
    active: 0.14,
    recovery: 0.52,
    damage: 19,
    cost: 22,
    range: 1.85,
  },
};
export const isAttack = (a: Action): a is Attack => a in moves;
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const damageFor = (base: number, money: number, combo = 0) =>
  base * (0.9 + money * 0.08) * Math.max(0.65, 1 - combo * 0.08);
export const blockReduction = (money: number) =>
  clamp(0.55 + money * 0.06, 0.55, 0.82);
export const reactionSeconds = (ai: number) => 0.43 - ((ai - 1) / 3) * 0.26;
export const counterWindow = (ai: number) => 0.09 + ai * 0.02;
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Fighter {
  definition;
  health = 100;
  stamina = 100;
  action: Action = 'idle';
  age = 0;
  x: number;
  z = 0;
  facing = 1;
  attackId = 0;
  connected = false;
  counterUntil = 0;
  counterBonusUntil = 0;
  lastActionAt = -10;
  combo = 0;
  constructor(
    public id: FighterId,
    x: number,
  ) {
    this.definition = fighterById(id);
    this.x = x;
  }
  get activeAttack() {
    return (
      isAttack(this.action) &&
      this.age >= moves[this.action].startup &&
      this.age < moves[this.action].startup + moves[this.action].active
    );
  }
  get invulnerable() {
    return this.action === 'dodge' && this.age >= 0.08 && this.age < 0.26;
  }
  get ready() {
    return (
      this.action === 'idle' ||
      this.action === 'walk_forward' ||
      this.action === 'block'
    );
  }
  setAction(action: Action) {
    if (this.action === action) return;
    this.action = action;
    this.age = 0;
    if (isAttack(action)) {
      this.attackId++;
      this.connected = false;
    }
  }
}
export type CombatEvent = {
  type:
    | 'hit'
    | 'block'
    | 'dodge'
    | 'counter'
    | 'attack'
    | 'ko'
    | 'decision'
    | 'sudden-death';
  side: number;
  damage?: number;
  heavy?: boolean;
};
export interface FightSnapshot {
  health: [number, number];
  stamina: [number, number];
  timer: number;
  actions: [Action, Action];
  ended: boolean;
  winner: number | null;
  method: 'K.O.' | 'DECISION';
  suddenDeath: boolean;
}
export interface PhysicsBridge {
  sync(fighters: Fighter[]): void;
  step(dt: number): void;
  overlaps(attacker: number, defender: number): boolean;
}
export class CpuController {
  private nextDecision = 0;
  private observedAttack = 0;
  private seenAt = 0;
  private command = emptyCommand();
  private history: {
    t: number;
    x: number;
    z: number;
    action: Action;
    attackId: number;
  }[] = [];
  private repeated = 0;
  private lastAttack: Action = 'idle';
  constructor(private random: () => number) {}
  update(t: number, cpu: Fighter, player: Fighter): CombatCommand {
    // A delayed visible-world snapshot is the only source of attack perception.
    this.history.push({
      t,
      x: player.x,
      z: player.z,
      action: player.action,
      attackId: player.attackId,
    });
    const cutoff = t - reactionSeconds(cpu.definition.ai);
    while (this.history.length > 1 && this.history[1].t <= cutoff)
      this.history.shift();
    const view = this.history[0];
    const c = emptyCommand();
    const dx = player.x - cpu.x,
      dz = player.z - cpu.z,
      distance = Math.hypot(dx, dz);
    if (distance > 1.35) {
      c.moveX = Math.sign(dx);
      c.moveZ = Math.abs(dz) > 0.18 ? Math.sign(dz) : 0;
    }
    if (distance < 0.87) c.moveX = -Math.sign(dx);
    if (t < this.nextDecision) {
      c.blockHeld = this.command.blockHeld;
      return c;
    }
    this.nextDecision = t + 1 / (4 + cpu.definition.ai);
    if (view.attackId !== this.observedAttack) {
      this.observedAttack = view.attackId;
      this.seenAt = t;
      if (view.action === this.lastAttack) this.repeated++;
      else this.repeated = 0;
      this.lastAttack = view.action;
    }
    const threatened =
      isAttack(view.action) && distance < 1.9 && t - this.seenAt < 0.5;
    if (
      threatened &&
      cpu.stamina > 20 &&
      this.random() <
        0.3 + cpu.definition.ai * 0.1 + Math.min(0.12, this.repeated * 0.03)
    ) {
      if (cpu.definition.ai >= 3 && this.random() < 0.38) c.dodgePressed = true;
      else c.blockHeld = true;
    } else if (cpu.stamina < 20) {
      c.moveX = -Math.sign(dx);
      c.blockHeld = this.random() < 0.32;
    } else if (distance < 1.7 && cpu.ready) {
      const r = this.random();
      if (r < 0.59) {
        c.kickPressed = distance > 1.15 || r < 0.28;
        c.punchPressed = !c.kickPressed;
        c.heavy = cpu.definition.money >= 3 && this.random() < 0.28;
      } else if (r > 0.88) c.blockHeld = true;
    }
    this.command = c;
    return c;
  }
}
export class CombatEngine {
  fighters: [Fighter, Fighter];
  time = 0;
  remaining: number = gameRules.roundSeconds;
  ended = false;
  winner: number | null = null;
  method: 'K.O.' | 'DECISION' = 'K.O.';
  suddenDeath = false;
  readonly random;
  readonly cpu;
  events: CombatEvent[] = [];
  constructor(
    player: FighterId,
    cpu: FighterId,
    seed = 1234,
    public physics?: PhysicsBridge,
    private policy = gameRules.outcomePolicy,
    private canonical?: FighterId,
  ) {
    this.fighters = [new Fighter(player, -1.15), new Fighter(cpu, 1.15)];
    this.fighters[1].facing = -1;
    this.random = seededRandom(seed);
    this.cpu = new CpuController(this.random);
  }
  update(dt: number, command: CombatCommand) {
    if (this.ended) return;
    this.events = [];
    this.time += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    const commands = [
      command,
      this.cpu.update(this.time, this.fighters[1], this.fighters[0]),
    ];
    this.fighters.forEach((f, i) =>
      this.advanceFighter(f, this.fighters[1 - i], commands[i], dt, i),
    );
    // Prevent the kinematic capsules crossing; then project inside each octagon plane.
    const [a, b] = this.fighters;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz);
    if (d < 0.68) {
      const nx = d > 0.001 ? dx / d : 1,
        nz = d > 0.001 ? dz / d : 0;
      const push = (0.68 - d) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
    for (const f of this.fighters)
      for (let i = 0; i < 8; i++) {
        const n = (i * Math.PI) / 4;
        const dot = f.x * Math.cos(n) + f.z * Math.sin(n);
        if (dot > 3.65) {
          f.x -= (dot - 3.65) * Math.cos(n);
          f.z -= (dot - 3.65) * Math.sin(n);
        }
      }
    this.physics?.sync(this.fighters);
    this.physics?.step(dt);
    this.resolve(0, 1);
    if (!this.ended) this.resolve(1, 0);
    if (!this.ended && this.remaining <= 0) {
      if (Math.abs(a.health - b.health) < 0.001) {
        this.suddenDeath = true;
        this.remaining = 15;
        this.events.push({ type: 'sudden-death', side: 0 });
      } else this.finish(a.health > b.health ? 0 : 1, 'DECISION');
    }
  }
  private advanceFighter(
    f: Fighter,
    other: Fighter,
    c: CombatCommand,
    dt: number,
    side: number,
  ) {
    f.age += dt;
    f.facing = other.x >= f.x ? 1 : -1;
    if (
      isAttack(f.action) &&
      f.age >=
        moves[f.action].startup +
          moves[f.action].active +
          moves[f.action].recovery
    )
      f.setAction('idle');
    if (
      (f.action === 'hit' && f.age > 0.25) ||
      (f.action === 'stunned' && f.age > 0.5) ||
      (f.action === 'dodge' && f.age > 0.62)
    )
      f.setAction('idle');
    if (f.action === 'block' && !c.blockHeld) f.setAction('idle');
    if (f.ready) {
      if (c.dodgePressed && f.stamina >= 18) {
        f.stamina -= 18;
        f.setAction('dodge');
        this.events.push({ type: 'dodge', side });
      } else if (c.blockHeld && f.stamina > 1) {
        f.setAction('block');
      } else if (c.punchPressed || c.kickPressed) {
        const action: Attack = c.kickPressed
          ? c.heavy
            ? 'kick_power'
            : 'kick_front'
          : c.heavy
            ? 'punch_heavy'
            : 'punch_light';
        if (f.stamina >= moves[action].cost) {
          f.stamina -= moves[action].cost;
          f.combo = this.time - f.lastActionAt < 1.2 ? f.combo + 1 : 0;
          f.lastActionAt = this.time;
          f.setAction(action);
          this.events.push({ type: 'attack', side, heavy: c.heavy });
        }
      } else if (c.moveX || c.moveZ) {
        f.setAction('walk_forward');
        const n = Math.hypot(c.moveX, c.moveZ);
        f.x += (c.moveX / n) * 2.35 * dt;
        f.z += (c.moveZ / n) * 2.35 * dt;
      } else f.setAction('idle');
    }
    if (f.action === 'dodge') {
      const move = c.moveX || -f.facing;
      f.x += move * 3.8 * dt;
      if (c.moveZ) f.z += c.moveZ * 2 * dt;
    }
    if (f.invulnerable)
      f.counterUntil = this.time + counterWindow(f.definition.ai);
    if (f.ready)
      f.stamina = Math.min(
        100,
        f.stamina + dt * (f.action === 'block' ? 5 : 15),
      );
  }
  private resolve(ai: number, di: number) {
    const a = this.fighters[ai],
      d = this.fighters[di];
    if (!a.activeAttack || a.connected || !isAttack(a.action)) return;
    const move = moves[a.action];
    const overlap = this.physics
      ? this.physics.overlaps(ai, di)
      : Math.hypot(a.x - d.x, a.z - d.z) <= move.range;
    if (!overlap) return;
    a.connected = true;
    if (d.invulnerable) {
      d.counterBonusUntil = this.time + 0.8;
      return;
    }
    if (
      d.counterUntil >= this.time &&
      d.action !== 'hit' &&
      d.action !== 'stunned'
    ) {
      a.setAction('stunned');
      d.counterBonusUntil = this.time + 0.8;
      this.events.push({ type: 'counter', side: di });
      return;
    }
    let damage =
      damageFor(move.damage, a.definition.money, a.combo) *
      (0.95 + this.random() * 0.1) *
      (a.counterBonusUntil > this.time ? 1.25 : 1);
    a.counterBonusUntil = 0;
    const blocked =
      d.action === 'block' &&
      d.age >= 0.06 &&
      Math.sign(a.x - d.x) === d.facing;
    if (blocked) {
      damage *= 1 - blockReduction(d.definition.money);
      d.stamina = Math.max(0, d.stamina - move.damage * 0.85);
      if (d.stamina === 0) d.setAction('stunned');
      this.events.push({ type: 'block', side: di, damage });
    } else {
      d.setAction('hit');
      d.x += a.facing * (move.damage >= 14 ? 0.28 : 0.12);
      this.events.push({
        type: 'hit',
        side: di,
        damage,
        heavy: move.damage >= 14,
      });
    }
    d.health = Math.max(0, d.health - damage);
    if (d.health <= 0 || (this.suddenDeath && !blocked))
      this.finish(ai, 'K.O.');
  }
  finish(winner: number, method: 'K.O.' | 'DECISION') {
    if (this.ended) return;
    if (this.policy === 'canonical' && this.canonical)
      winner = this.fighters.findIndex((f) => f.id === this.canonical);
    this.ended = true;
    this.winner = winner;
    this.method = method;
    this.fighters[winner].setAction('victory');
    this.fighters[1 - winner].setAction(method === 'K.O.' ? 'ko' : 'idle');
    this.events.push({
      type: method === 'K.O.' ? 'ko' : 'decision',
      side: winner,
    });
  }
  snapshot(): FightSnapshot {
    return {
      health: [this.fighters[0].health, this.fighters[1].health],
      stamina: [this.fighters[0].stamina, this.fighters[1].stamina],
      timer: Math.ceil(this.remaining),
      actions: [this.fighters[0].action, this.fighters[1].action],
      ended: this.ended,
      winner: this.winner,
      method: this.method,
      suddenDeath: this.suddenDeath,
    };
  }
}
