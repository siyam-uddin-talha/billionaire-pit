import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import {
  Vector3,
  Color3,
  Color4,
  Quaternion,
} from '@babylonjs/core/Maths/math';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import {
  AssetContainer,
  type InstantiatedEntries,
} from '@babylonjs/core/assetContainer';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import HavokPhysics from '@babylonjs/havok';
import havokWasm from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Audio/audioEngine';
import '@babylonjs/core/Animations/animatable';
import { fighters, fighterById, type FighterId } from '../data/fighters';
import { rounds, opponentFor } from '../data/rounds';
import {
  CombatEngine,
  type FightSnapshot,
  type Action,
  type CombatEvent,
} from '../game/CombatEngine';
import { InputManager } from '../game/InputManager';
import { HavokPhysicsWorld } from './HavokPhysicsWorld';
import { BabylonAudioManager } from './BabylonAudioManager';
import { createChampionshipTrophy, trophyGrip } from './ChampionshipTrophy';

let havokPromise: ReturnType<typeof HavokPhysics> | null = null;
export type ViewMode =
  | 'menu'
  | 'select'
  | 'intro'
  | 'fight'
  | 'paused'
  | 'result'
  | 'trophy';
interface FighterView {
  root: TransformNode;
  entries: InstantiatedEntries;
  clips: Map<string, AnimationGroup>;
  action: string;
  head: TransformNode | null;
  headRest: Quaternion;
}
export class BabylonGame {
  engine: Engine;
  scene: Scene;
  input: InputManager;
  audio!: BabylonAudioManager;
  combat: CombatEngine | null = null;
  mode: ViewMode = 'menu';
  private camera: ArcRotateCamera;
  private containers = new Map<string, AssetContainer>();
  private views: FighterView[] = [];
  private physics!: HavokPhysicsWorld;
  private arena: TransformNode | null = null;
  private platform: TransformNode;
  private trophy: TransformNode | null = null;
  private ceremonyStarted = 0;
  private glow: GlowLayer;
  private shadow: ShadowGenerator;
  private rim: PointLight;
  private particles: ParticleSystem;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private disposed = false;
  private accumulator = 0;
  private uiClock = 0;
  private animationTime = 0;
  private freeze = 0;
  private shake = 0;
  private selected: FighterId = 'elon_musk';
  private resize = () => this.engine.resize();
  onSnapshot: (s: FightSnapshot) => void = () => {};
  onResult: (s: FightSnapshot) => void = () => {};
  onEvent: (e: CombatEvent) => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        stencil: true,
        antialias: true,
        audioEngine: true,
      },
      true,
    );
    this.engine.setHardwareScalingLevel(
      1 / Math.min(window.devicePixelRatio || 1, 2),
    );
    this.scene = new Scene(this.engine);
    this.scene.onBeforeRenderObservable.add(() => {
      this.updateTrophyGrip();
      this.updateArenaFaces();
    });
    this.scene.clearColor = new Color4(0.035, 0.043, 0.039, 0);
    this.scene.ambientColor = new Color3(0.35, 0.36, 0.33);
    this.camera = new ArcRotateCamera(
      'broadcast',
      Math.PI / 2 + 0.12,
      1.35,
      4.9,
      new Vector3(0, 1.1, 0),
      this.scene,
    );
    this.camera.fov = 0.6;
    this.camera.minZ = 0.1;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 14;
    const fill = new HemisphericLight(
      'softbox',
      new Vector3(0, 1, 0.5),
      this.scene,
    );
    fill.intensity = 0.7;
    fill.groundColor = new Color3(0.2, 0.22, 0.25);
    const key = new DirectionalLight(
      'key',
      new Vector3(0.7, -1, -0.6),
      this.scene,
    );
    key.position = new Vector3(-3, 5, 4);
    key.intensity = 1.3;
    key.diffuse = new Color3(0.95, 0.96, 0.86);
    this.rim = new PointLight(
      'lime rim',
      new Vector3(1.8, 2.8, -1.2),
      this.scene,
    );
    this.rim.diffuse = Color3.FromHexString('#d2ff43');
    this.rim.intensity = 2.1;
    this.rim.range = 6;
    const blue = new PointLight(
      'cool edge',
      new Vector3(-2, 2.8, -3),
      this.scene,
    );
    blue.diffuse = new Color3(0.82, 0.88, 1);
    blue.intensity = 0.85;
    blue.range = 7;
    this.shadow = new ShadowGenerator(1024, key);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.shadow.bias = 0.003;
    this.glow = new GlowLayer('neon bloom', this.scene, { blurKernelSize: 32 });
    this.glow.intensity = 0.16;
    this.platform = this.buildStage();
    this.particles = this.buildParticles();
    this.input = new InputManager();
    window.addEventListener('resize', this.resize);
    this.engine.runRenderLoop(() => this.render());
  }
  async initialize(
    progress: (percent: number) => void,
    sound: boolean,
    onAudioFail: () => void,
  ) {
    const started = performance.now();
    progress(5);
    havokPromise ??= HavokPhysics({ locateFile: () => havokWasm });
    const havok = await havokPromise;
    if (this.disposed) return;
    const plugin = new HavokPlugin(true, havok);
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
    this.scene.physicsEnabled = false;
    this.physics = new HavokPhysicsWorld(this.scene, plugin);
    progress(20);
    const names = [...fighters.map((f) => f.id), 'arena'];
    let loaded = 0;
    await Promise.all(
      names.map(async (name) => {
        const asset = await LoadAssetContainerAsync(
          '/models/' + name + '.glb',
          this.scene,
        );
        if (this.disposed) {
          asset.dispose();
          return;
        }
        this.containers.set(name, asset);
        progress(20 + (++loaded / names.length) * 70);
      }),
    );
    if (this.disposed) return;
    this.audio = new BabylonAudioManager(this.scene, sound, onAudioFail);
    await this.audio.ready;
    if (this.disposed) return;
    this.createArena();
    this.showFighter('elon_musk');
    progress(96);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, 1200 - (performance.now() - started))),
    );
    if (!this.disposed) {
      progress(100);
      this.engine.resize();
    }
  }
  private material(name: string, color: string, emissive = false) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.15, 0.15, 0.15);
    if (emissive) m.emissiveColor = m.diffuseColor;
    m.backFaceCulling = false;
    return m;
  }
  private buildStage() {
    const root = new TransformNode('showcase platform', this.scene);
    const floor = MeshBuilder.CreateCylinder(
      'machined platform',
      { diameter: 2.45, height: 0.16, tessellation: 64 },
      this.scene,
    );
    floor.position.y = -0.1;
    floor.material = this.material('platform steel', '#19201b');
    floor.parent = root;
    floor.receiveShadows = true;
    const center = MeshBuilder.CreateCylinder(
      'platform top',
      { diameter: 2.24, height: 0.025, tessellation: 64 },
      this.scene,
    );
    center.position.y = -0.012;
    center.material = this.material('platform matte', '#282f29');
    center.parent = root;
    center.receiveShadows = true;
    for (const [diameter, y] of [
      [2.43, -0.06],
      [2.1, 0.006],
    ]) {
      const ring = MeshBuilder.CreateTorus(
        'luminous platform ring',
        { diameter, thickness: 0.013, tessellation: 80 },
        this.scene,
      );
      ring.position.y = y;
      ring.material = this.material('ring', '#c2f451', true);
      ring.parent = root;
    }
    const lines: Vector3[][] = [];
    for (let i = -12; i <= 12; i++) {
      lines.push([new Vector3(i, -0.19, -12), new Vector3(i, -0.19, 12)]);
      lines.push([new Vector3(-12, -0.19, i), new Vector3(12, -0.19, i)]);
    }
    const grid = MeshBuilder.CreateLineSystem(
      'floor grid',
      { lines },
      this.scene,
    );
    grid.color = new Color3(0.025, 0.035, 0.02);
    grid.alpha = 0.3;
    for (let i = 0; i < 10; i++) {
      const light = MeshBuilder.CreateBox(
        'distant light strip',
        { width: 0.014, height: 0.6 + (i % 3) * 0.2, depth: 0.025 },
        this.scene,
      );
      light.position.set((i - 4.5) * 1.6, 1.8, -5.8);
      light.material = this.material('distant neon', '#6d862d', true);
    }
    return root;
  }
  private createArena() {
    const entries = this.containers.get('arena')!.instantiateModelsToScene();
    const root = new TransformNode('arena root', this.scene);
    entries.rootNodes.forEach((n) => (n.parent = root));
    for (const mesh of root.getChildMeshes()) {
      mesh.receiveShadows = true;
      mesh.computeWorldMatrix(true);
      const p = mesh.getBoundingInfo().boundingBox.centerWorld;
      if (p.z < -1 && p.y > 0.4) mesh.visibility = 0.04;
    }
    // A subtle functional octagon marking and the arena title are rendered onto the mat.
    const texture = new DynamicTexture(
      'mat print',
      { width: 1024, height: 1024 },
      this.scene,
      false,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.strokeStyle = '#7b8b65';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const x = 512 + 430 * Math.cos(a),
        y = 512 + 430 * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#728062';
    ctx.font = 'bold 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BILLIONAIRE', 512, 490);
    ctx.font = 'bold 135px sans-serif';
    ctx.fillText('PIT', 512, 630);
    texture.update();
    const decal = MeshBuilder.CreateGround(
      'arena mat markings',
      { width: 8, height: 8 },
      this.scene,
    );
    decal.position.y = 0.019;
    decal.rotation.y = Math.PI;
    const mat = new StandardMaterial('mat ink', this.scene);
    mat.diffuseTexture = texture;
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = Color3.Black();
    decal.material = mat;
    decal.parent = root;
    // A single batched wire mesh per rear cage panel keeps the fight readable.
    for (let side = 0; side < 8; side++) {
      const aa = (side * Math.PI) / 4 + Math.PI / 8,
        bb = ((side + 1) * Math.PI) / 4 + Math.PI / 8;
      const p = new Vector3(4.5 * Math.cos(aa), 0, 4.5 * Math.sin(aa)),
        q = new Vector3(4.5 * Math.cos(bb), 0, 4.5 * Math.sin(bb));
      if ((p.z + q.z) / 2 < -1) continue;
      const wires: Vector3[][] = [];
      const point = (u: number, y: number) =>
        new Vector3(p.x + (q.x - p.x) * u, y, p.z + (q.z - p.z) * u);
      for (let j = -8; j < 25; j++) {
        for (const sign of [-1, 1]) {
          let u0 = j / 16,
            u1 = u0 + sign * 0.4;
          let y0 = 0.12,
            y1 = 1.78;
          if (u0 < 0) {
            y0 += ((0 - u0) / (u1 - u0)) * 1.66;
            u0 = 0;
          }
          if (u0 > 1) {
            y0 += ((1 - u0) / (u1 - u0)) * 1.66;
            u0 = 1;
          }
          if (u1 < 0) {
            y1 = 0.12 + ((0 - j / 16) / (sign * 0.4)) * 1.66;
            u1 = 0;
          }
          if (u1 > 1) {
            y1 = 0.12 + ((1 - j / 16) / (sign * 0.4)) * 1.66;
            u1 = 1;
          }
          if (y0 <= y1 && y0 >= 0.12 && y1 <= 1.78)
            wires.push([point(u0, y0), point(u1, y1)]);
        }
      }
      if (wires.length) {
        const mesh = MeshBuilder.CreateLineSystem(
          'cage wire ' + side,
          { lines: wires },
          this.scene,
        );
        mesh.color = new Color3(0.13, 0.17, 0.11);
        mesh.alpha = 0.45;
        mesh.parent = root;
      }
    }
    root.setEnabled(false);
    this.arena = root;
  }
  private fighter(id: FighterId) {
    const entries = this.containers
      .get(id)!
      .instantiateModelsToScene((n) => id + '_' + n, true);
    const root = new TransformNode('view ' + id, this.scene);
    entries.rootNodes.forEach((n) => (n.parent = root));
    const clips = new Map<string, AnimationGroup>();
    for (const group of entries.animationGroups) {
      group.stop();
      const name = group.name.replace(id + '_', '');
      clips.set(name, group);
      for (const a of group.targetedAnimations) {
        a.animation.enableBlending = true;
        a.animation.blendingSpeed = 0.16;
      }
    }
    for (const mesh of root.getChildMeshes()) {
      this.shadow.addShadowCaster(mesh);
      if (mesh.material instanceof PBRMaterial) {
        mesh.material.environmentIntensity = 0.8;
        mesh.material.directIntensity = 1;
      }
    }
    const headBone = entries.skeletons
      .flatMap((s) => s.bones)
      .find((b) => b.name.endsWith('head'));
    const head = headBone?.getTransformNode() ?? null;
    const headRest = Quaternion.Identity();
    headBone
      ?.getRestMatrix()
      .decompose(Vector3.One(), headRest, Vector3.Zero());
    return { root, entries, clips, action: '', head, headRest };
  }
  private animate(view: FighterView, action: string) {
    if (action === view.action) return;
    for (const g of view.clips.values()) g.stop();
    const clip =
      view.clips.get(action === 'stunned' ? 'hit' : action) ||
      view.clips.get('idle');
    clip?.start(
      action === 'idle' || action === 'walk_forward' || action === 'block',
      1,
    );
    view.action = action;
  }
  private clearViews() {
    for (const v of this.views) {
      for (const m of v.root.getChildMeshes())
        this.shadow.removeShadowCaster(m);
      v.entries.dispose();
      v.root.dispose();
    }
    this.views = [];
  }
  showFighter(id: FighterId) {
    if (!this.containers.has(id)) return;
    this.selected = id;
    this.clearViews();
    this.views = [this.fighter(id)];
    this.animate(this.views[0], 'idle');
    this.platform.setEnabled(true);
    this.arena?.setEnabled(false);
    this.trophy?.setEnabled(false);
    this.rim.diffuse = Color3.FromHexString(fighterById(id).accent);
    this.camera.radius = 4.45;
    this.camera.beta = 1.4;
    this.camera.alpha = Math.PI / 2 + 0.12;
    this.camera.target.set(0, 1.1, 0);
    this.engine.resize();
  }
  startRound(round: number, player: FighterId, winners: FighterId[] = []) {
    this.input.clear();
    this.accumulator = 0;
    this.clearViews();
    const cpu = opponentFor(round, player, winners);
    this.views = [this.fighter(player), this.fighter(cpu)];
    this.combat = new CombatEngine(
      player,
      cpu,
      Math.floor(Math.random() * 1e9),
      this.physics,
      undefined,
      [player, cpu].includes(rounds[round].canonical)
        ? rounds[round].canonical
        : player,
    );
    this.platform.setEnabled(false);
    this.arena?.setEnabled(true);
    this.trophy?.setEnabled(false);
    this.rim.diffuse = Color3.FromHexString(rounds[round].accent);
    const tint = Color3.FromHexString(rounds[round].accent);
    this.particles.color1 = new Color4(tint.r, tint.g, tint.b, 1);
    this.particles.color2 =
      round > 0 ? new Color4(0.3, 0.85, 1, 1) : new Color4(1, 0.8, 0.2, 1);
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = 1.37;
    this.camera.radius = 10.8;
    this.camera.target.set(0, 0.8, 0);
    this.syncViews();
    this.onSnapshot(this.combat.snapshot());
    this.engine.resize();
  }
  setMode(mode: ViewMode) {
    this.engine.resize();
    this.mode = mode;
    this.input.clear();
    this.accumulator = 0;
    this.audio?.setSuspended(mode === 'paused');
    if (mode === 'fight') this.audio?.play('heavy');
    if (mode === 'result') this.syncViews();
    if (mode === 'trophy') this.ceremony();
  }
  private ceremony() {
    this.clearViews();
    this.views = [this.fighter(this.selected)];
    this.animate(this.views[0], 'trophy_lift');
    this.arena?.setEnabled(false);
    this.platform.setEnabled(true);
    this.ceremonyStarted = performance.now();
    if (this.trophy) {
      this.trophy
        .getChildMeshes()
        .forEach((mesh) => this.shadow.removeShadowCaster(mesh));
      this.trophy.dispose(false, true);
    }
    {
      this.trophy = createChampionshipTrophy(
        this.scene,
        fighterById(this.selected).name,
      );
      this.trophy.scaling.setAll(0.6);
      this.trophy
        .getChildMeshes()
        .forEach((mesh) => this.shadow.addShadowCaster(mesh));
    }
    this.trophy.setEnabled(true);
    const lift = this.views[0].clips.get('trophy_lift');
    if (lift) lift.speedRatio = 0.65;
    this.updateTrophyGrip();
    this.camera.alpha = Math.PI / 2;
    this.camera.beta = 1.4;
    this.camera.radius = 5.5;
    this.camera.target.set(0, 1.3, 0);
    this.audio?.play('trophy');
    this.audio?.play('cheer');
    this.burst(new Vector3(0, 2.7, 0), true);
  }
  private updateTrophyGrip() {
    if (this.mode !== 'trophy' || !this.trophy || !this.views[0]) return;
    const view = this.views[0];
    const bones = view.entries.skeletons.flatMap((s) => s.bones);
    const t = Math.min(1, (performance.now() - this.ceremonyStarted) / 2600);
    const eased = t * t * (3 - 2 * t);
    // A fixed-size cup rises between both hands. Arm rotations solve each grip
    // without stretching bones or moving the trophy to only one wrist.
    this.trophy.rotation.set(0, 0, 0);
    this.trophy.position.set(
      0,
      1.3 + eased * 1.04 - trophyGrip.y * 0.6,
      0.28 - eased * 0.12,
    );
    this.trophy.computeWorldMatrix(true);
    for (const side of ['L', 'R']) {
      const hand = bones
        .find((b) => b.name.endsWith('hand.' + side))
        ?.getTransformNode();
      const joints = ['forearm.', 'upper_arm.'].map((prefix) =>
        bones.find((b) => b.name.endsWith(prefix + side))?.getTransformNode(),
      );
      if (!hand || joints.some((joint) => !joint)) continue;
      hand.computeWorldMatrix(true);
      const sign = hand.getAbsolutePosition().x >= 0 ? 1 : -1;
      const target = Vector3.TransformCoordinates(
        new Vector3(sign * trophyGrip.x, trophyGrip.y, 0),
        this.trophy.getWorldMatrix(),
      );
      for (let iteration = 0; iteration < 24; iteration++) {
        for (const joint of joints) {
          const parent = joint!.parent as TransformNode;
          parent.computeWorldMatrix(true);
          const inverse = parent.getWorldMatrix().clone().invert();
          hand.computeWorldMatrix(true);
          const from = Vector3.TransformCoordinates(
            hand.getAbsolutePosition(),
            inverse,
          )
            .subtract(joint!.position)
            .normalize();
          const to = Vector3.TransformCoordinates(target, inverse)
            .subtract(joint!.position)
            .normalize();
          const delta = Quaternion.Identity();
          Quaternion.FromUnitVectorsToRef(from, to, delta);
          joint!.rotationQuaternion = delta.multiply(
            joint!.rotationQuaternion ??
              Quaternion.FromEulerVector(joint!.rotation),
          );
          joint!.computeWorldMatrix(true);
        }
        hand.computeWorldMatrix(true);
        if (
          Vector3.DistanceSquared(hand.getAbsolutePosition(), target) < 0.000004
        )
          break;
      }
    }
  }
  private updateArenaFaces() {
    if (
      !['fight', 'intro', 'result', 'paused'].includes(this.mode) ||
      !this.combat
    )
      return;
    this.views.forEach((view, i) => {
      if (!view.head) return;
      // Use the rest pose every frame, never the previous adjusted rotation.
      // This removes idle/head-clip wobble and avoids accumulating camera yaw.
      view.head.rotationQuaternion = Quaternion.RotationAxis(
        Vector3.Up(),
        this.combat!.fighters[i].facing * -0.5,
      ).multiply(view.headRest);
      view.head.computeWorldMatrix(true);
    });
  }

  private syncViews() {
    if (!this.combat) return;
    this.combat.fighters.forEach((f, i) => {
      const v = this.views[i];
      if (!v) return;
      v.root.position.set(f.x, 0, f.z);
      v.root.rotation.y = f.facing * (Math.PI / 2 + 0.35);
      this.animate(v, f.action);
    });
  }
  private buildParticles() {
    const texture = new DynamicTexture(
      'spark',
      { width: 32, height: 32 },
      this.scene,
      false,
    );
    const ctx = texture.getContext();
    ctx.fillStyle = 'white';
    ctx.fillRect(7, 7, 18, 18);
    texture.update();
    const p = new ParticleSystem('pooled impact particles', 180, this.scene);
    p.particleTexture = texture;
    p.minLifeTime = 0.15;
    p.maxLifeTime = 0.5;
    p.minSize = 0.018;
    p.maxSize = 0.055;
    p.minEmitPower = 1.5;
    p.maxEmitPower = 4;
    p.direction1 = new Vector3(-1, 0.3, -1);
    p.direction2 = new Vector3(1, 1, 1);
    p.gravity = new Vector3(0, -5, 0);
    p.emitRate = 0;
    p.color1 = new Color4(0.82, 1, 0.25, 1);
    p.color2 = new Color4(1, 0.75, 0.25, 1);
    p.colorDead = new Color4(0.5, 0.6, 0.1, 0);
    p.start();
    return p;
  }
  private burst(position: Vector3, celebration = false) {
    if (this.reduced) return;
    this.particles.emitter = position;
    this.particles.manualEmitCount = celebration ? 120 : 22;
  }
  private handleEvent(e: CombatEvent) {
    this.onEvent(e);
    const f = this.combat!.fighters[e.side];
    if (e.type === 'hit' || e.type === 'block' || e.type === 'counter') {
      this.audio.play(
        e.type === 'block' ? 'block' : e.heavy ? 'heavy' : 'impact',
      );
      this.burst(new Vector3(f.x, 1.35, f.z));
      if (!this.reduced) {
        this.shake = e.heavy ? 0.07 : 0.025;
        this.freeze = e.heavy ? 0.055 : 0.025;
      }
    } else if (e.type === 'attack' || e.type === 'dodge')
      this.audio.play('whoosh');
    else if (e.type === 'ko' || e.type === 'decision') {
      this.audio.play('ko');
      this.audio.play('cheer');
      this.burst(new Vector3(f.x, 2, f.z), true);
      this.selected = f.id;
      this.freeze = 0.15;
    }
  }
  private render() {
    if (this.disposed || document.hidden) return;
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    this.animationTime += dt;
    if (this.mode === 'fight' && this.combat && !this.combat.ended) {
      if (this.freeze > 0) {
        this.freeze -= dt;
      } else {
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= 1 / 60 && steps++ < 5) {
          this.combat.update(1 / 60, this.input.read());
          for (const e of this.combat.events) this.handleEvent(e);
          this.accumulator -= 1 / 60;
          if (this.combat.ended) {
            const result = this.combat.snapshot();
            this.onSnapshot(result);
            this.onResult(result);
            break;
          }
        }
        if (steps >= 5) this.accumulator = 0;
      }
      this.syncViews();
      this.uiClock += dt;
      if (this.uiClock > 0.065) {
        this.onSnapshot(this.combat.snapshot());
        this.uiClock = 0;
      }
    }
    if (this.mode === 'menu' || this.mode === 'select') {
      if (this.views[0] && !this.reduced)
        this.views[0].root.rotation.y =
          Math.sin(this.animationTime * 0.23) * 0.12;
    }
    if (this.mode === 'fight' && this.combat) {
      const [a, b] = this.combat.fighters;
      const radius = Math.max(
        6.5,
        Math.min(12.5, 5.9 + Math.abs(a.x - b.x) * 0.6),
      );
      this.camera.radius += (radius - this.camera.radius) * Math.min(1, dt * 2);
      this.camera.target.x +=
        (0.5 * (a.x + b.x) - this.camera.target.x) * dt * 3;
      if (this.shake > 0.002) {
        this.camera.target.y =
          1.02 + Math.sin(this.animationTime * 70) * this.shake;
        this.shake *= 0.83;
      } else this.camera.target.y = 1.02;
    }
    this.scene.animationsEnabled = this.mode !== 'paused';
    if (
      this.mode === 'trophy' &&
      !this.reduced &&
      Math.sin(this.animationTime * 2) > 0.998
    )
      this.burst(new Vector3(0, 3, 0), true);
    this.scene.render();
  }
  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.audio?.dispose();
    this.physics?.dispose();
    this.clearViews();
    for (const c of this.containers.values()) c.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
