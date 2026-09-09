import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import {
  PhysicsShapeBox,
  PhysicsShapeCapsule,
} from '@babylonjs/core/Physics/v2/physicsShape';
import {
  PhysicsMotionType,
  PhysicsEventType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import {
  type Fighter,
  type PhysicsBridge,
  isAttack,
  moves,
} from '../game/CombatEngine';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
export class HavokPhysicsWorld implements PhysicsBridge {
  bodies: PhysicsBody[] = [];
  fighterBodies: PhysicsBody[] = [];
  attackBodies: PhysicsBody[] = [];
  private nodes: TransformNode[] = [];
  private contacts = new Set<string>();
  constructor(
    private scene: Scene,
    private plugin: HavokPlugin,
  ) {
    const floor = this.body(
      'floor',
      new Vector3(0, -0.2, 0),
      PhysicsMotionType.STATIC,
    );
    floor.shape = new PhysicsShapeBox(
      Vector3.Zero(),
      Quaternion.Identity(),
      new Vector3(11, 0.4, 11),
      scene,
    );
    floor.shape.filterMembershipMask = 1;
    floor.shape.filterCollideMask = 6;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const wall = this.body(
        'boundary-' + i,
        new Vector3(Math.cos(angle) * 4.15, 1, Math.sin(angle) * 4.15),
        PhysicsMotionType.STATIC,
      );
      wall.shape = new PhysicsShapeBox(
        Vector3.Zero(),
        Quaternion.RotationAxis(Vector3.Up(), -angle),
        new Vector3(0.15, 2.5, 3.5),
        scene,
      );
      wall.shape.filterMembershipMask = 1;
      wall.shape.filterCollideMask = 6;
    }
    for (let i = 0; i < 2; i++) {
      const capsule = this.body(
        'fighter-' + i,
        new Vector3(i ? 1.15 : -1.15, 0, 0),
        PhysicsMotionType.ANIMATED,
      );
      capsule.shape = new PhysicsShapeCapsule(
        new Vector3(0, 0.36, 0),
        new Vector3(0, 1.6, 0),
        0.32,
        scene,
      );
      capsule.shape.filterMembershipMask = i ? 4 : 2;
      capsule.shape.filterCollideMask = 1 | (i ? 2 : 4) | (i ? 8 : 16);
      this.fighterBodies.push(capsule);
      const attack = this.body(
        'attack-' + i,
        new Vector3(0, -20, 0),
        PhysicsMotionType.ANIMATED,
      );
      attack.shape = new PhysicsShapeBox(
        Vector3.Zero(),
        Quaternion.Identity(),
        new Vector3(1, 0.48, 0.52),
        scene,
      );
      attack.shape.isTrigger = true;
      attack.shape.filterMembershipMask = i ? 16 : 8;
      attack.shape.filterCollideMask = i ? 2 : 4;
      this.attackBodies.push(attack);
    }
    const debrisMaterial = new StandardMaterial('physical arena props', scene);
    debrisMaterial.diffuseColor = new Color3(0.12, 0.17, 0.07);
    debrisMaterial.emissiveColor = new Color3(0.015, 0.024, 0.003);
    for (let i = 0; i < 4; i++) {
      const prop = this.body(
        'loose corner block ' + i,
        new Vector3(i % 2 ? 3.2 : -3.2, 0.35, i < 2 ? 1.4 : -1.4),
        PhysicsMotionType.DYNAMIC,
      );
      prop.shape = new PhysicsShapeBox(
        Vector3.Zero(),
        Quaternion.Identity(),
        new Vector3(0.18, 0.18, 0.18),
        scene,
      );
      prop.shape.filterMembershipMask = 1;
      prop.shape.filterCollideMask = 7;
      prop.setMassProperties({ mass: 0.6 });
      const mesh = MeshBuilder.CreateBox(
        'corner block ' + i,
        { size: 0.18 },
        scene,
      );
      mesh.parent = prop.transformNode;
      mesh.material = debrisMaterial;
    }
    plugin.onTriggerCollisionObservable.add((e) => {
      const ai = this.attackBodies.indexOf(e.collider);
      const bi = this.attackBodies.indexOf(e.collidedAgainst);
      const a = ai >= 0 ? ai : bi;
      const defender = this.fighterBodies.indexOf(
        ai >= 0 ? e.collidedAgainst : e.collider,
      );
      if (a < 0 || defender < 0) return;
      const key = a + ':' + defender;
      if (e.type === PhysicsEventType.TRIGGER_EXITED) this.contacts.delete(key);
      else this.contacts.add(key);
    });
  }
  private body(name: string, position: Vector3, type: PhysicsMotionType) {
    const node = new TransformNode(name, this.scene);
    node.position.copyFrom(position);
    node.rotationQuaternion = Quaternion.Identity();
    const b = new PhysicsBody(node, type, false, this.scene);
    b.disablePreStep = false;
    this.nodes.push(node);
    this.bodies.push(b);
    return b;
  }
  sync(fighters: Fighter[]) {
    fighters.forEach((f, i) => {
      const b = this.fighterBodies[i];
      b.transformNode.position.set(f.x, 0, f.z);
      const a = this.attackBodies[i];
      if (f.activeAttack && isAttack(f.action)) {
        const range = moves[f.action].range;
        a.transformNode.position.set(
          f.x + f.facing * (range - 0.82),
          1.28,
          f.z,
        );
      } else {
        a.transformNode.position.y = -20;
        this.contacts.delete(i + ':' + (1 - i));
      }
    });
  }
  step(dt: number) {
    this.plugin.executeStep(dt, this.bodies);
  }
  overlaps(a: number, d: number) {
    return this.contacts.has(a + ':' + d);
  }
  dispose() {
    for (const b of this.bodies) {
      const shape = b.shape;
      b.dispose();
      shape?.dispose();
    }
    for (const n of this.nodes) n.dispose();
    this.contacts.clear();
  }
}
