import * as THREE from "three"
import { beltMarkers } from "../shared/belt-markers"
import { gateBoxAt, gateOpenAt } from "../shared/obstacles"
import { ARROW_VERTICES, routeMarkers } from "../shared/route-markers"
import type { ConveyorSpec, CourseDefinition, GateSpec } from "../shared/types"
import { boxMesh, type MeshTools } from "./obstacle-meshes"

export type GateMesh = {
  spec: GateSpec
  group: THREE.Group
  panel: THREE.Mesh
  material: THREE.MeshPhysicalMaterial
  lamps: THREE.MeshBasicMaterial
}
export type BeltMesh = { spec: ConveyorSpec; group: THREE.Group; arrows: THREE.InstancedMesh }

/** Painted arrows mark fork entrances and safe jump-transfer windows. */
export function buildRouteArrows(course: CourseDefinition, tools: MeshTools): THREE.Group {
  const group = new THREE.Group()
  const geometry = tools.geometry.get("route-arrow", () => {
    const shape = new THREE.BufferGeometry()
    shape.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        ARROW_VERTICES.flatMap(([x, z]) => [x, 0, z]),
        3,
      ),
    )
    shape.computeVertexNormals()
    return shape
  })
  for (const { position, yaw, width } of routeMarkers(course)) {
    const arrow = new THREE.Mesh(
      geometry,
      tools.vinyl.get("#ffffff", { roughness: 1, clearcoat: 0 }),
    )
    arrow.position.set(position.x, position.y + 0.025, position.z)
    arrow.rotation.y = yaw
    arrow.scale.setScalar(width / 1.2)
    group.add(arrow)
  }
  return group
}

export function buildGate(spec: GateSpec, tools: MeshTools): GateMesh {
  const group = new THREE.Group()
  const material = tools.vinyl.get(spec.color, { roughness: 0.4, clearcoat: 0.3 })
  // Each gate has its own changing colour; keep the cached source immutable.
  const animated = material.clone()
  const panel = boxMesh(gateBoxAt(spec, 0), animated, 0.12, tools)
  panel.name = `gate:${spec.id}`
  group.add(panel)
  const top = spec.box.center.y - spec.box.halfExtents.y
  const lamps = new THREE.MeshBasicMaterial({ color: "#ff6573" })
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      tools.geometry.get("gate-post", () => new THREE.BoxGeometry(0.4, 7.8, 0.7)),
      tools.vinyl.get("#384258", { roughness: 0.8 }),
    )
    const offset = side * (spec.box.halfExtents.x + 0.25)
    post.position.set(
      spec.box.center.x + Math.cos(spec.box.yaw) * offset,
      top + 3.7,
      spec.box.center.z - Math.sin(spec.box.yaw) * offset,
    )
    const light = new THREE.Mesh(
      tools.geometry.get("gate-lamp", () => new THREE.SphereGeometry(0.32, 12, 8)),
      lamps,
    )
    light.position.set(post.position.x, top + 3.5, spec.box.center.z - 0.5)
    group.add(post, light)
  }
  return { spec, group, panel, material: animated, lamps }
}

export function buildBelt(spec: ConveyorSpec, tools: MeshTools): BeltMesh {
  const group = new THREE.Group()
  const surface = boxMesh(
    spec.box,
    tools.vinyl.get(spec.color, { roughness: 0.7, clearcoat: 0.1 }),
    0.05,
    tools,
  )
  group.add(surface)
  const geometry = tools.geometry.get("belt-arrow", () => {
    const mesh = new THREE.BufferGeometry()
    mesh.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.42, 0, -0.35, 0, 0, 0.5, 0.42, 0, -0.35], 3),
    )
    mesh.computeVertexNormals()
    return mesh
  })
  const arrows = new THREE.InstancedMesh(
    geometry,
    tools.vinyl.get("#ffffff", { roughness: 1, clearcoat: 0 }),
    12,
  )
  arrows.frustumCulled = false
  group.add(arrows)
  return { spec, group, arrows }
}

export function updateContent(
  gates: readonly GateMesh[],
  belts: readonly BeltMesh[],
  timeSec: number,
): void {
  for (const gate of gates) {
    const box = gateBoxAt(gate.spec, timeSec)
    gate.panel.position.set(box.center.x, box.center.y, box.center.z)
    const open = gateOpenAt(gate.spec, timeSec) > 0.7
    gate.material.color.set(open ? "#8fe870" : gate.spec.color)
    gate.lamps.color.set(open ? "#8fe870" : "#ff6573")
  }
  const matrix = new THREE.Matrix4()
  for (const { spec, arrows } of belts) {
    for (const [index, { position, yaw, scale }] of beltMarkers(spec, timeSec).entries()) {
      matrix
        .makeRotationY(yaw)
        .scale(new THREE.Vector3(scale, scale, scale))
        .setPosition(position.x, position.y + 0.018, position.z)
      arrows.setMatrixAt(index, matrix)
    }
    arrows.instanceMatrix.needsUpdate = true
  }
}

/** Landmarks sit outside playable surfaces and give each course a silhouette. */
export function buildLandmarks(course: CourseDefinition, tools: MeshTools): THREE.Group {
  const group = new THREE.Group()
  const theme = course.theme
  if (theme === undefined) return group
  for (const [index, checkpoint] of course.checkpoints.entries()) {
    for (const side of [-1, 1]) {
      const x = checkpoint.respawn.x + side * 11
      const z = checkpoint.respawn.z + 2
      const top = checkpoint.respawn.y - 1.1
      const material = tools.vinyl.get(index % 2 ? theme.accent : theme.rest, {
        roughness: 0.65,
        clearcoat: 0.1,
      })
      let geometry: THREE.BufferGeometry
      if (theme.landmark === "clouds")
        geometry = tools.geometry.get("sky-ring", () => new THREE.TorusGeometry(3.1, 0.16, 8, 28))
      else if (theme.landmark === "candy")
        geometry = tools.geometry.get("candy-disc", () => new THREE.SphereGeometry(1.5, 16, 12))
      else if (theme.landmark === "canyon")
        geometry = tools.geometry.get(
          `spire-${index % 2}`,
          () => new THREE.CylinderGeometry(0.8, 2.2, 8 + (index % 2) * 3, 6),
        )
      else geometry = tools.geometry.get("tower", () => new THREE.BoxGeometry(1.4, 7, 1.4))
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, top + (theme.landmark === "candy" ? 5 : 3.5), z)
      mesh.rotation.y = side * 0.3
      group.add(mesh)
      if (theme.landmark === "candy" || theme.landmark === "festival") {
        const pole = new THREE.Mesh(
          tools.geometry.get("landmark-pole", () => new THREE.CylinderGeometry(0.12, 0.18, 6, 8)),
          material,
        )
        pole.position.set(x, top + 2, z)
        group.add(pole)
      }
      if (theme.landmark === "factory" || theme.landmark === "festival") {
        const cap = new THREE.Mesh(
          tools.geometry.get("tower-cap", () => new THREE.ConeGeometry(1.2, 1.5, 8)),
          tools.vinyl.get(theme.rest),
        )
        cap.position.set(x, top + 7.5, z)
        group.add(cap)
      }
    }
  }
  return group
}
