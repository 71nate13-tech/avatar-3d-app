import * as THREE from 'three'

/** Builds the world the avatar stands in: lights, ground, and backdrop. */
export function createScene(): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a24)

  // Key light, angled so the avatar has a readable light and shadow side.
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 20
  const shadowExtent = 3
  key.shadow.camera.left = -shadowExtent
  key.shadow.camera.right = shadowExtent
  key.shadow.camera.top = shadowExtent
  key.shadow.camera.bottom = -shadowExtent
  scene.add(key)

  // Fill from the opposite side so the shadow side is not pure black.
  const fill = new THREE.DirectionalLight(0x8899ff, 0.5)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  // Sky/ground ambient, so bounced light differs above and below.
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2a35, 1.0))

  const groundGeometry = new THREE.CircleGeometry(6, 64)
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2e3d, roughness: 1, metalness: 0 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(12, 24, 0x4a4a66, 0x3a3a4e)
  // Just above the ground plane, or the two surfaces fight for the same pixels.
  grid.position.y = 0.002
  scene.add(grid)

  return {
    scene,
    dispose: () => {
      groundGeometry.dispose()
      groundMaterial.dispose()
      grid.geometry.dispose()
      ;(Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => m.dispose())
    },
  }
}
