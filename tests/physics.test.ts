import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import HavokPhysics from '@babylonjs/havok';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { HavokPhysicsWorld } from '../src/engine/HavokPhysicsWorld';
import { CombatEngine } from '../src/game/CombatEngine';
import { emptyCommand } from '../src/game/InputManager';
it('real Havok trigger contacts resolve an attack once and reject a miss', async () => {
  const havok = await HavokPhysics({
    wasmBinary: readFileSync(
      'node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',
    ).buffer as ArrayBuffer,
  });
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const plugin = new HavokPlugin(true, havok);
  expect(scene.enablePhysics(new Vector3(0, -9.81, 0), plugin)).toBe(true);
  scene.physicsEnabled = false;
  const world = new HavokPhysicsWorld(scene, plugin);
  const fight = new CombatEngine('elon_musk', 'mark_zuckerberg', 1, world);
  fight.cpu.update = () => emptyCommand();
  fight.fighters[0].x = -0.5;
  fight.fighters[1].x = 0.5;
  for (let i = 0; i < 25; i++)
    fight.update(1 / 60, { ...emptyCommand(), punchPressed: i === 0 });
  expect(fight.fighters[1].health).toBeLessThan(100);
  expect(fight.fighters[1].health).toBeGreaterThan(88);
  const hp = fight.fighters[1].health;
  fight.fighters[1].x = 3;
  for (let i = 0; i < 80; i++)
    fight.update(1 / 60, { ...emptyCommand(), kickPressed: i === 10 });
  expect(fight.fighters[1].health).toBe(hp);
  world.dispose();
  scene.dispose();
  engine.dispose();
});
