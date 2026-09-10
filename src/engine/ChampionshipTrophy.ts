import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';

export const trophyGrip = new Vector3(0.43, 0.53, 0);

export function createChampionshipTrophy(scene: Scene, winnerName: string) {
  const root = new TransformNode('championship trophy', scene);
  // Small studio reflection map gives metal soft highlights without external assets.
  const faces = Array.from({ length: 6 }, (_, face) => {
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const strip = x > 7 && x < 13 && y > 3 && y < 28;
        const value =
          face === 2 ? 185 : strip ? 240 : 35 + Math.round(35 * (1 - y / 32));
        const i = (y * 32 + x) * 4;
        pixels.set([value, value, value, 255], i);
      }
    return pixels;
  });
  const reflection = new RawCubeTexture(scene, faces, 32);
  reflection.name = 'Trophy studio reflections';
  const gold = new PBRMaterial('Polished championship gold', scene);
  gold.albedoColor = new Color3(0.83, 0.57, 0.19);
  gold.metallic = 0.92;
  gold.roughness = 0.24;
  gold.reflectionTexture = reflection;
  const base = new PBRMaterial('Black stone trophy base', scene);
  base.albedoColor = new Color3(0.018, 0.022, 0.025);
  base.metallic = 0.12;
  base.roughness = 0.3;
  base.reflectionTexture = reflection;
  const lathe = (name: string, profile: number[][], material: PBRMaterial) => {
    const mesh = MeshBuilder.CreateLathe(
      name,
      {
        shape: profile.map(
          ([radius, height]) => new Vector3(radius, height, 0),
        ),
        tessellation: 96,
      },
      scene,
    );
    mesh.material = material;
    mesh.parent = root;
    mesh.receiveShadows = true;
    return mesh;
  };
  lathe(
    'Beveled stone plinth',
    [
      [0, 0],
      [0.21, 0],
      [0.23, 0.015],
      [0.23, 0.1],
      [0.21, 0.12],
      [0, 0.12],
    ],
    base,
  );
  lathe(
    'Gold foot and tapered stem',
    [
      [0, 0.12],
      [0.18, 0.12],
      [0.18, 0.14],
      [0.14, 0.16],
      [0.065, 0.19],
      [0.05, 0.29],
      [0.08, 0.32],
      [0, 0.32],
    ],
    gold,
  );
  lathe(
    'Hollow spun gold cup',
    [
      [0, 0.3],
      [0.09, 0.3],
      [0.14, 0.34],
      [0.2, 0.41],
      [0.25, 0.51],
      [0.28, 0.63],
      [0.29, 0.7],
      [0.29, 0.72],
      [0.275, 0.73],
      [0.26, 0.72],
      [0.255, 0.68],
      [0.245, 0.61],
      [0.215, 0.51],
      [0.16, 0.4],
      [0.09, 0.35],
      [0, 0.35],
    ],
    gold,
  );
  for (const side of [-1, 1]) {
    const path = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      return new Vector3(
        side * (0.245 + 0.185 * Math.sin(Math.PI * t)),
        0.68 - 0.3 * t,
        0,
      );
    });
    const handle = MeshBuilder.CreateTube(
      'Sculpted gold handle',
      { path, radius: 0.023, tessellation: 16, cap: 3 },
      scene,
    );
    handle.material = gold;
    handle.parent = root;
  }
  const plaque = MeshBuilder.CreatePlane(
    'Engraved champion plaque',
    { width: 0.38, height: 0.105 },
    scene,
  );
  plaque.parent = root;
  plaque.position.set(0, 0.065, 0.231);
  plaque.rotation.y = Math.PI;
  const lettering = new DynamicTexture(
    'Championship engraving',
    { width: 1024, height: 256 },
    scene,
    false,
  );
  root.metadata = { winnerName };
  const ctx = lettering.getContext();
  ctx.fillStyle = '#b58a40';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#302410';
  const engravedName = winnerName.toUpperCase();
  ctx.font = `bold ${Math.min(76, Math.floor(1500 / engravedName.length))}px sans-serif`;
  ctx.fillText(
    engravedName,
    (1024 - ctx.measureText(engravedName).width) / 2,
    108,
  );
  ctx.font = '42px sans-serif';
  ctx.fillText('CHAMPION', (1024 - ctx.measureText('CHAMPION').width) / 2, 183);
  lettering.update();
  const engraving = new StandardMaterial('Engraved brass', scene);
  engraving.diffuseTexture = lettering;
  engraving.specularColor = new Color3(0.4, 0.3, 0.15);
  plaque.material = engraving;
  return root;
}
