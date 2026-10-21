import * as THREE from 'three';
import {
  VISUAL,
  type ArenaBoundaryMaterialRole,
  type ResolvedArenaBoundaryPrimitive,
  type ResolvedArenaGeometry,
} from '@rocket-arena/shared';
import {
  createDaylightExteriorPresentation,
  createDaylightGameplayPresentation,
  type ArenaPresentationResources,
} from './arena-presentation.js';
import { glslColor, glslFloat, withWorldPattern } from './world-pattern.js';

export interface ArenaPadDescriptor {
  readonly id: string;
  readonly kind: 'large' | 'small';
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number, number];
}

export interface ArenaBoundaryMeshMetadata {
  readonly primitiveId: string;
  readonly surfaceId: string;
  readonly seamIds: readonly string[];
  readonly semanticKind: ResolvedArenaBoundaryPrimitive['semanticKind'];
  readonly region: ResolvedArenaBoundaryPrimitive['region'];
  readonly materialRole: ArenaBoundaryMaterialRole;
  readonly geometryIdentity: Readonly<{
    readonly sourceVersion: number;
    readonly primitiveSchemaVersion: number;
    readonly fingerprint: string;
  }>;
}

export interface ArenaOwnership {
  readonly geometry: ResolvedArenaGeometry;
  readonly authoritativeBoundaries: THREE.Group;
  readonly gameplayOverlays: THREE.Group;
  readonly exteriorPresentation: THREE.Group;
  readonly padDescriptors: readonly ArenaPadDescriptor[];
  readonly disposed: boolean;
  getObjectByName(name: string): THREE.Object3D | undefined;
  update(deltaSeconds: number, elapsedSeconds: number): void;
  dispose(): void;
}

interface ResourceOwnership extends ArenaPresentationResources {}

interface StadiumAnchors {
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfWidth: number;
  readonly halfLength: number;
  readonly ceilingY: number;
  readonly goalBackDistance: number;
}

function createResourceOwnership(): ResourceOwnership {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  return {
    geometries,
    materials,
    textures,
    ownGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
      geometries.add(geometry);
      return geometry;
    },
    ownMaterial<T extends THREE.Material>(material: T): T {
      materials.add(material);
      return material;
    },
    ownTexture<T extends THREE.Texture>(texture: T): T {
      textures.add(texture);
      return texture;
    },
  };
}

function geometryFromInwardSurface(
  primitive: ResolvedArenaBoundaryPrimitive,
  resources: ResourceOwnership,
): THREE.BufferGeometry {
  const surface = primitive.inwardSurface;
  const positions = new Float32Array(surface.positions.length * 3);
  const normals = new Float32Array(surface.normals.length * 3);
  const uvs = new Float32Array(surface.uvs.length * 2);

  for (let index = 0; index < surface.positions.length; index += 1) {
    const position = surface.positions[index]!;
    const normal = surface.normals[index]!;
    const uv = surface.uvs[index]!;
    positions[index * 3] = position[0];
    positions[index * 3 + 1] = position[1];
    positions[index * 3 + 2] = position[2];
    normals[index * 3] = normal[0];
    normals[index * 3 + 1] = normal[1];
    normals[index * 3 + 2] = normal[2];
    uvs[index * 2] = uv[0];
    uvs[index * 2 + 1] = uv[1];
  }

  const IndexArray = surface.positions.length > 65_535 ? Uint32Array : Uint16Array;
  const geometry = resources.ownGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(new IndexArray(surface.indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The containment wall.
 *
 * It was a 20%-opacity pane with `depthWrite` disabled, which meant it never
 * occluded anything at all: the crowd, the skyline, and the sky read straight
 * through it, and a car driving up the wall had no visible surface underneath it
 * to judge position or height against. That is the defect this fixes.
 *
 * Opaque now, and patterned so both of the things a driver needs are legible
 * while on it: height, through evenly spaced rows plus a bright kick plate at the
 * bottom and a cool cap at the top, and position along the wall, through vertical
 * panel seams. Team identity strengthens toward each goal end and washes out at
 * midfield, the way the reference arena reads from above.
 */
function createContainmentMaterial(
  resources: ResourceOwnership,
  anchors: StadiumAnchors,
  rampRise: number,
  wallTopY: number,
): THREE.MeshStandardMaterial {
  const seamSpacing = Math.max((anchors.halfLength * 2) / 24, 1);
  const pattern = `
  {
    vec3 wp = vArenaWorld;
    float h = clamp(
      (wp.y - ${glslFloat(rampRise)}) / max(${glslFloat(wallTopY - rampRise)}, 0.001),
      0.0,
      1.0
    );

    // Whichever axis runs along this stretch of wall, so seams stay vertical and
    // evenly spaced on the sides, the ends, and the corner cuts alike.
    float along = abs(wp.x) * ${glslFloat(anchors.halfLength)}
      >= abs(wp.z) * ${glslFloat(anchors.halfWidth)} ? wp.z : wp.x;

    float seamPhase = fract(along / ${glslFloat(seamSpacing)});
    float seam = 1.0 - smoothstep(0.0, 0.045, min(seamPhase, 1.0 - seamPhase));

    float teamWeight = smoothstep(0.18, 0.95, abs(wp.z) / ${glslFloat(anchors.halfLength)});
    // Two strengths of the same identity. The deep tint colours the glass just
    // enough to say whose half you are looking at; the bright one carries the
    // lines, because a dark tint at low alpha reads as no tint at all.
    vec3 teamDeep = wp.z < 0.0
      ? ${glslColor(VISUAL.PALETTE.FIELD_BLUE)}
      : ${glslColor(VISUAL.PALETTE.FIELD_ORANGE)};
    vec3 teamBright = wp.z < 0.0
      ? ${glslColor(VISUAL.PALETTE.BLUE)}
      : ${glslColor(VISUAL.PALETTE.ORANGE)};

    // The glass itself: barely there, with a little of its half's colour so the
    // pane is not simply absent. This is most of the wall by area.
    vec3 tint = mix(
      ${glslColor(VISUAL.PALETTE.GLASS)},
      teamDeep,
      0.30 + 0.42 * teamWeight
    );
    float alpha = 0.11 + 0.05 * teamWeight;

    // Frame mullions between the panes. Visible enough to give the wall a scale
    // to read position against, faint enough not to become a surface.
    tint = mix(tint, ${glslColor(VISUAL.PALETTE.STRUCTURE_LIGHT)}, seam * 0.70);
    alpha = mix(alpha, 0.32, seam);

    // The line where the wall leaves the ramp: where a car starts climbing.
    float kick = 1.0 - smoothstep(0.0, 0.05, h);
    tint = mix(
      tint,
      mix(${glslColor(VISUAL.PALETTE.FIELD_LINE)}, teamBright, 0.45 + 0.35 * teamWeight),
      kick * 0.92
    );
    alpha = mix(alpha, 0.78, kick);

    // The one thick band that stays solid. It is the strongest identity cue on
    // the wall and the easiest thing to read while sideways on it, so it is the
    // one thing here that is not glass.
    float stripe = 1.0 - smoothstep(0.0, 0.055, abs(h - 0.30));
    tint = mix(tint, teamBright * 1.45, stripe * 0.96);
    alpha = mix(alpha, 0.97, stripe);

    // A thin cap where the pane meets the ceiling curve.
    float cap = smoothstep(0.93, 1.0, h);
    tint = mix(tint, ${glslColor(VISUAL.PALETTE.STRUCTURE_LIGHT)}, cap * 0.55);
    alpha = mix(alpha, 0.42, cap);

    diffuseColor.rgb = tint * mix(0.96, 1.12, h);
    diffuseColor.a = clamp(alpha, 0.0, 1.0);
  }`;

  return resources.ownMaterial(withWorldPattern(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.06,
      // Per-fragment alpha is what makes one band solid inside a transparent
      // pane, so the material has to be a blended one and must not write depth,
      // or the glass would occlude the field behind it.
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
    pattern,
  ));
}

/**
 * The floor-to-wall ramp band.
 *
 * A driver has to know where the floor stops being flat, because that is where a
 * car starts climbing whether or not it meant to. The band carries the team tint
 * of the half it is in and a bright line along its top edge, so the start of the
 * curve is something you can see rather than something you discover.
 */
function createLowerTransitionMaterial(
  resources: ResourceOwnership,
  anchors: StadiumAnchors,
  rampRise: number,
): THREE.MeshStandardMaterial {
  const pattern = `
  {
    vec3 wp = vArenaWorld;
    float t = clamp(wp.y / max(${glslFloat(rampRise)}, 0.001), 0.0, 1.0);
    float teamWeight = smoothstep(0.18, 0.95, abs(wp.z) / ${glslFloat(anchors.halfLength)});
    vec3 team = wp.z < 0.0
      ? ${glslColor(VISUAL.PALETTE.FIELD_BLUE)}
      : ${glslColor(VISUAL.PALETTE.FIELD_ORANGE)};

    vec3 c = mix(
      ${glslColor(VISUAL.PALETTE.STRUCTURE_DARK)},
      ${glslColor(VISUAL.PALETTE.STRUCTURE_MID)},
      0.25 + 0.40 * t
    );
    c = mix(c, team, teamWeight * 0.45 + 0.12);
    c = mix(c, ${glslColor(VISUAL.PALETTE.FIELD_LINE)}, smoothstep(0.86, 1.0, t) * 0.50);
    diffuseColor.rgb = c;
  }`;

  return resources.ownMaterial(withWorldPattern(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.30,
      side: THREE.FrontSide,
    }),
    pattern,
  ));
}

function createBoundaryMaterials(
  resources: ResourceOwnership,
  resolvedGeometry: ResolvedArenaGeometry,
  anchors: StadiumAnchors,
  refractiveCeiling: boolean,
): Readonly<Record<ArenaBoundaryMaterialRole, THREE.Material>> {
  // Both risers come from the resolved geometry rather than from a local copy of
  // the numbers, so the paint cannot describe a curve the collider does not have.
  const rampRise = resolvedGeometry.profiles.floorWall.rise;
  const wallTopY = anchors.ceilingY - resolvedGeometry.profiles.wallCeiling.rise;

  return Object.freeze({
    'field-floor': resources.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x155c35,
      roughness: 0.88,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })),
    'field-lower-transition': createLowerTransitionMaterial(resources, anchors, rampRise),
    'field-containment': createContainmentMaterial(resources, anchors, rampRise, wallTopY),
    'field-ceiling': resources.ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xc8edf5,
      roughness: 0.06,
      metalness: 0.03,
      // Transmission renders the opaque stadium a second time. Plain alpha
      // keeps the transparent roof without that extra scene pass.
      transmission: refractiveCeiling ? 0.16 : 0,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.FrontSide,
    })),
    // The two goal interiors were near-black and within a few points of each
    // other, so which end you were looking into was not something the colour told
    // you. They stay dark, because a lit recess hides the ball, but they now carry
    // enough of their own team to be told apart at a glance.
    'blue-goal': resources.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x14304a,
      roughness: 0.56,
      metalness: 0.48,
      side: THREE.FrontSide,
    })),
    'orange-goal': resources.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x4a2a15,
      roughness: 0.56,
      metalness: 0.48,
      side: THREE.FrontSide,
    })),
  });
}

function immutableBoundaryMetadata(
  primitive: ResolvedArenaBoundaryPrimitive,
  geometry: ResolvedArenaGeometry,
): ArenaBoundaryMeshMetadata {
  return Object.freeze({
    primitiveId: primitive.id,
    surfaceId: primitive.surfaceId,
    seamIds: Object.freeze([...primitive.inwardSurface.seamIds]),
    semanticKind: primitive.semanticKind,
    region: primitive.region,
    materialRole: primitive.materialRole,
    geometryIdentity: Object.freeze({
      sourceVersion: geometry.identity.sourceVersion,
      primitiveSchemaVersion: geometry.identity.primitiveSchemaVersion,
      fingerprint: geometry.identity.fingerprint,
    }),
  });
}

function createAuthoritativeBoundaries(
  root: THREE.Group,
  resolvedGeometry: ResolvedArenaGeometry,
  resources: ResourceOwnership,
  materials: Readonly<Record<ArenaBoundaryMaterialRole, THREE.Material>>,
): ReadonlyMap<string, THREE.BufferGeometry> {
  const geometriesByPrimitive = new Map<string, THREE.BufferGeometry>();
  for (const primitive of resolvedGeometry.primitives) {
    const geometry = geometryFromInwardSurface(primitive, resources);
    const mesh = new THREE.Mesh(geometry, materials[primitive.materialRole]);
    mesh.name = `arena-boundary:${primitive.id}`;
    // The wall and the ceiling are both blended panes, so both have to be held
    // back for transparency sorting and neither can take a shadow.
    const isGlass = primitive.materialRole === 'field-containment'
      || primitive.materialRole === 'field-ceiling';
    mesh.receiveShadow = !isGlass;
    mesh.renderOrder = isGlass ? 2 : 0;
    mesh.userData = Object.freeze({
      arenaBoundary: immutableBoundaryMetadata(primitive, resolvedGeometry),
    });
    root.add(mesh);
    geometriesByPrimitive.set(primitive.id, geometry);
  }
  return geometriesByPrimitive;
}

function createStadiumAnchors(resolvedGeometry: ResolvedArenaGeometry): StadiumAnchors {
  const min = resolvedGeometry.bounds.min;
  const max = resolvedGeometry.bounds.max;
  return Object.freeze({
    centerX: (min[0] + max[0]) / 2,
    centerZ: (min[2] + max[2]) / 2,
    halfWidth: (max[0] - min[0]) / 2,
    halfLength: (max[2] - min[2]) / 2,
    ceilingY: max[1],
    goalBackDistance: Math.max(
      Math.abs(resolvedGeometry.enclosureBounds.min[2]),
      Math.abs(resolvedGeometry.enclosureBounds.max[2]),
    ),
  });
}

/**
 * Create the resolved-geometry-driven Rocket Arena stadium.
 *
 * Exactly three scene roots are owned by the returned handle. Authoritative
 * vertices are copied directly from ResolvedArenaGeometry.inwardSurface and are
 * never reconstructed from presentation constants.
 */
export function createArena(
  scene: THREE.Scene,
  resolvedGeometry: ResolvedArenaGeometry,
  padDescriptors: readonly ArenaPadDescriptor[] = [],
  options: { readonly refractiveCeiling?: boolean } = {},
): ArenaOwnership {
  const resources = createResourceOwnership();
  const unitBox = resources.ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const authoritativeBoundaries = new THREE.Group();
  authoritativeBoundaries.name = 'arena-authoritative-boundaries';
  const gameplayOverlays = new THREE.Group();
  gameplayOverlays.name = 'arena-gameplay-overlays';
  const exteriorPresentation = new THREE.Group();
  exteriorPresentation.name = 'arena-exterior-presentation';

  // Anchors are resolved first because the wall and ramp paint are sized from the
  // arena's own dimensions. `createStadiumAnchors` reads only the resolved
  // geometry, so moving it ahead of the materials changes nothing else.
  const anchors = createStadiumAnchors(resolvedGeometry);
  const materials = createBoundaryMaterials(resources, resolvedGeometry, anchors, options.refractiveCeiling === true);
  const boundaryGeometries = createAuthoritativeBoundaries(
    authoritativeBoundaries,
    resolvedGeometry,
    resources,
    materials,
  );
  const animatedGoalMaterials = createDaylightGameplayPresentation(
    gameplayOverlays,
    resolvedGeometry,
    boundaryGeometries,
    resources,
    unitBox,
    anchors,
  );
  // BoostPadVisuals owns pad rendering separately; descriptors never create
  // placeholder or implied collectable geometry in the arena itself.
  const retainedPadDescriptors = Object.freeze([...padDescriptors]);
  const exteriorAnimation = createDaylightExteriorPresentation(
    exteriorPresentation,
    resolvedGeometry,
    resources,
    unitBox,
    anchors,
  );

  scene.add(authoritativeBoundaries, gameplayOverlays, exteriorPresentation);
  let isDisposed = false;

  const ownership: ArenaOwnership = {
    geometry: resolvedGeometry,
    authoritativeBoundaries,
    gameplayOverlays,
    exteriorPresentation,
    padDescriptors: retainedPadDescriptors,
    get disposed(): boolean {
      return isDisposed;
    },
    getObjectByName(name: string): THREE.Object3D | undefined {
      return authoritativeBoundaries.getObjectByName(name)
        ?? gameplayOverlays.getObjectByName(name)
        ?? exteriorPresentation.getObjectByName(name);
    },
    update(deltaSeconds: number, elapsedSeconds: number): void {
      if (isDisposed) return;
      const finiteElapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      const finiteDelta = Number.isFinite(deltaSeconds) ? THREE.MathUtils.clamp(deltaSeconds, 0, 0.1) : 0;
      exteriorAnimation.atmosphere.rotation.y = Math.sin(finiteElapsed * 0.025) * 0.012;
      exteriorAnimation.flags.rotation.z = Math.sin(finiteElapsed * 0.7) * 0.006;
      const pulse = THREE.MathUtils.clamp(
        2.72 + Math.sin(finiteElapsed * 2.05) * 0.22 + finiteDelta * 0.08,
        2.45,
        3.05,
      );
      for (const material of animatedGoalMaterials) material.emissiveIntensity = pulse;
    },
    dispose(): void {
      if (isDisposed) return;
      isDisposed = true;
      authoritativeBoundaries.removeFromParent();
      gameplayOverlays.removeFromParent();
      exteriorPresentation.removeFromParent();
      authoritativeBoundaries.clear();
      gameplayOverlays.clear();
      exteriorPresentation.clear();
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      for (const texture of resources.textures) texture.dispose();
      resources.geometries.clear();
      resources.materials.clear();
      resources.textures.clear();
    },
  };
  return ownership;
}
