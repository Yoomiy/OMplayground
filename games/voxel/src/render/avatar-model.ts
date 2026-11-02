import * as THREE from 'three';
import { AVATAR_PRESETS, avatarLook } from './upstream/blockyard/avatar.ts';
import { BONES, buildCharacter, type CharacterMesh } from './upstream/blockyard/character/build.ts';
import { isAvatarId, selectAvatar } from '../shared/avatars.ts';

export const AVATAR_COUNT = AVATAR_PRESETS.length;
/** Stable across clients and reconnects; the eight original Blockyard guest presets. */
export const avatarVariant = (id: string, assigned?: number) =>
  isAvatarId(assigned) ? assigned : selectAvatar(id);
const assets = new Map<number, CharacterMesh>();
export function avatarAsset(variant: number): CharacterMesh {
  let asset = assets.get(variant);
  if (!asset) {
    asset = buildCharacter(avatarLook(AVATAR_PRESETS[variant].avatar));
    assets.set(variant, asset);
  }
  return asset;
}
export function avatarJoint(
  id: string,
  joint: keyof CharacterMesh['joints'],
  assigned?: number,
): THREE.Vector3 {
  const [x, y, z] = avatarAsset(avatarVariant(id, assigned)).joints[joint];
  return new THREE.Vector3(-x, y, -z);
}

/** One instanced mesh per preset. Original geometry/pixels; grouped joint animation on the GPU. */
export function avatarGeometry(asset: CharacterMesh): THREE.BufferGeometry {
  const position = asset.position.slice(),
    normal = asset.normal.slice();
  const pivot = new Float32Array(position.length),
    motion = new Float32Array(asset.bone.length);
  for (let i = 0; i < asset.bone.length; i++) {
    position[i * 3] *= -1;
    position[i * 3 + 2] *= -1;
    normal[i * 3] *= -1;
    normal[i * 3 + 2] *= -1;
    const bone = BONES[asset.bone[i]],
      right = bone.endsWith('R');
    const joint =
      bone === 'head'
        ? 'head'
        : /Arm|hand/.test(bone)
          ? right
            ? 'upperArmR'
            : 'upperArmL'
          : /Leg|foot/.test(bone)
            ? right
              ? 'upperLegR'
              : 'upperLegL'
            : null;
    if (joint) {
      const [x, y, z] = asset.joints[joint];
      pivot.set([-x, y, -z], i * 3);
      motion[i] = joint === 'head' ? 1 : /Arm/.test(joint) ? (right ? 2 : 3) : right ? 4 : 5;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(asset.uv, 2));
  geometry.setAttribute('pivot', new THREE.BufferAttribute(pivot, 3));
  geometry.setAttribute('motion', new THREE.BufferAttribute(motion, 1));
  geometry.setIndex(new THREE.BufferAttribute(asset.index, 1));
  return geometry;
}
export function avatarMaterial(texture: THREE.DataTexture): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uSkin: { value: texture }, uLight: { value: 1 } },
    vertexShader: `precision highp float;
in vec3 position,normal,pivot;in vec2 uv,pose;in float motion;in mat4 instanceMatrix;
uniform mat4 projectionMatrix,modelViewMatrix;out vec2 vUV;out float vShade;
void main(){float angle=motion<.5?0.:motion<1.5?pose.x:((motion<2.5||motion>4.5)?pose.y:-pose.y);
float c=cos(angle),s=sin(angle);mat3 turn=mat3(1.,0.,0.,0.,c,s,0.,-s,c);
vec3 p=pivot+turn*(position-pivot),n=normalize(mat3(instanceMatrix)*turn*normal);
vUV=uv;vShade=.72+.28*max(dot(n,normalize(vec3(.4,.8,-.6))),0.);
gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
    fragmentShader: `precision highp float;
uniform sampler2D uSkin;uniform float uLight;in vec2 vUV;in float vShade;out vec4 fragColor;
void main(){vec3 color=texture(uSkin,vUV).rgb*uLight*vShade;
fragColor=vec4(pow(color/(color+vec3(1.)),vec3(1./2.2)),1.);}`,
  });
}
