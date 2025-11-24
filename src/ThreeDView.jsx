// src/ThreeDView.jsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mmToMeters = mm => mm / 1000
const pxToMm = px => px / 0.5 // inverse of mmToPx = mm * 0.5 in Planner2D
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// same AABB overlap as in 2D
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y

export default function ThreeDView({ room, items, onChange }) {
  const mountRef = useRef(null)

  // scene-related refs (persist across re-renders)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const cabinetGroupRef = useRef(null)
  const cabinetMeshesRef = useRef([])
  const wallsRef = useRef(null)

  // latest props for use in event handlers
  const itemsRef = useRef(items)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // ---------- INITIAL SCENE SETUP (runs when room size changes) ----------
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 800
    const height = mount.clientHeight || 520
    const aspect = width / height

    // Scene & camera
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf6f6f6)

    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100)
    // camera at approx. eye height, slightly back and to the side
    camera.position.set(3, 1.6, 3)
    camera.lookAt(0, 0.9, 0) // look near worktop height

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(width, height)
    mount.innerHTML = ''
    mount.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    // Orbit/zoom around a point at worktop height
    controls.target.set(0, 0.9, 0)
    controls.update()

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7)
    hemiLight.position.set(0, 5, 0)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(5, 10, 2)
    scene.add(dirLight)

    // Room geometry
    const roomWidthM = mmToMeters(room.width)
    const roomDepthM = mmToMeters(room.depth)

    const floorGeom = new THREE.PlaneGeometry(roomWidthM, roomDepthM)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
    const floor = new THREE.Mesh(floorGeom, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const wallHeightM = 2.7
    const wallThicknessM = 0.05
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 })

    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidthM, wallHeightM, wallThicknessM),
      wallMaterial
    )
    northWall.position.set(0, wallHeightM / 2, -roomDepthM / 2)
    scene.add(northWall)

    const southWall = northWall.clone()
    southWall.position.set(0, wallHeightM / 2, roomDepthM / 2)
    scene.add(southWall)

    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThicknessM, wallHeightM, roomDepthM),
      wallMaterial
    )
    westWall.position.set(-roomWidthM / 2, wallHeightM / 2, 0)
    scene.add(westWall)

    const eastWall = westWall.clone()
    eastWall.position.set(roomWidthM / 2, wallHeightM / 2, 0)
    scene.add(eastWall)

    wallsRef.current = { northWall, southWall, eastWall, westWall }

    // Cabinets group
    const cabinetGroup = new THREE.Group()
    scene.add(cabinetGroup)
    cabinetGroupRef.current = cabinetGroup
    cabinetMeshesRef.current = []

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls

    // ---- DRAGGING SETUP ----
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hitPoint = new THREE.Vector3()
    const dragOffset = new THREE.Vector3()
    const originalPos = new THREE.Vector3()
    let draggingMesh = null

    const hasCollisionPx = (uid, xPx, yPx) => {
      const currentItems = itemsRef.current || []
      const item = currentItems.find(it => it.uid === uid)
      if (!item) return false

      const rectA = {
        x: xPx,
        y: yPx,
        w: item.width * 0.5,
        h: item.depth * 0.5,
      }

      return currentItems.some(other => {
        if (other.uid === uid) return false
        const rectB = {
          x: other.x ?? 0,
          y: other.y ?? 0,
          w: other.width * 0.5,
          h: other.depth * 0.5,
        }
        return rectsOverlap(rectA, rectB)
      })
    }

    const updateRay = event => {
      const rect = renderer.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      mouse.set(x, y)
      raycaster.setFromCamera(mouse, camera)
    }

    const onPointerDown = event => {
      updateRay(event)
      const intersects = raycaster.intersectObjects(cabinetMeshesRef.current)
      if (!intersects.length) return

      draggingMesh = intersects[0].object
      originalPos.copy(draggingMesh.position)

      raycaster.ray.intersectPlane(dragPlane, hitPoint)
      dragOffset.copy(hitPoint).sub(draggingMesh.position)
      controls.enabled = false
    }

    const onPointerMove = event => {
      if (!draggingMesh) return
      updateRay(event)
      if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return

      const target = hitPoint.sub(dragOffset)
      const halfRoomW = roomWidthM / 2
      const halfRoomD = roomDepthM / 2

      draggingMesh.position.x = clamp(target.x, -halfRoomW, halfRoomW)
      draggingMesh.position.z = clamp(target.z, -halfRoomD, halfRoomD)
    }

    const onPointerUp = () => {
      if (!draggingMesh) return

      const data = draggingMesh.userData || {}
      const currentOnChange = onChangeRef.current

      if (data.uid && typeof currentOnChange === 'function') {
        const { uid, widthMm, depthMm } = data

        const posX = draggingMesh.position.x
        const posZ = draggingMesh.position.z

        const mmX = posX * 1000 - widthMm / 2 + room.width / 2
        const mmZ = posZ * 1000 - depthMm / 2 + room.depth / 2

        let xPx = mmX * 0.5
        let yPx = mmZ * 0.5

        const maxX = (room.width - widthMm) * 0.5
        const maxY = (room.depth - depthMm) * 0.5

        xPx = clamp(Math.round(xPx), 0, maxX)
        yPx = clamp(Math.round(yPx), 0, maxY)

        // collision check – if colliding, revert, else update state
        if (hasCollisionPx(uid, xPx, yPx)) {
          draggingMesh.position.copy(originalPos)
        } else {
          currentOnChange(prev =>
            prev.map(it =>
              it.uid === uid ? { ...it, x: xPx, y: yPx } : it
            )
          )
        }
      }

      draggingMesh = null
      controls.enabled = true
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    // resize
    const onResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) return
      const newWidth = mount.clientWidth || width
      const newHeight = mount.clientHeight || height
      const cam = cameraRef.current
      const rend = rendererRef.current

      cam.aspect = newWidth / newHeight
      cam.updateProjectionMatrix()
      rend.setSize(newWidth, newHeight)
    }
    window.addEventListener('resize', onResize)

    // animation loop – also hide walls facing camera
    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)

      const cam = cameraRef.current
      const ctrls = controlsRef.current
      const rend = rendererRef.current
      const scn = sceneRef.current
      const ws = wallsRef.current

      if (ctrls) ctrls.update()

      if (ws && cam) {
        const { northWall, southWall, eastWall, westWall } = ws
        if (northWall && southWall && eastWall && westWall) {
          // show all
          northWall.visible = true
          southWall.visible = true
          eastWall.visible = true
          westWall.visible = true

          // hide walls closest to camera
          if (cam.position.z > 0) {
            southWall.visible = false
          } else {
            northWall.visible = false
          }

          if (cam.position.x > 0) {
            eastWall.visible = false
          } else {
            westWall.visible = false
          }
        }
      }

      if (rend && scn && cam) {
        rend.render(scn, cam)
      }
    }
    animate()

    // cleanup
    return () => {
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      cancelAnimationFrame(frameId)
      controls.dispose()
      renderer.dispose()
      mount.innerHTML = ''
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      controlsRef.current = null
      cabinetGroupRef.current = null
      cabinetMeshesRef.current = []
      wallsRef.current = null
    }
  }, [room.width, room.depth])

  // ---------- REBUILD CABINETS WHEN ITEMS CHANGE ----------
  useEffect(() => {
    const group = cabinetGroupRef.current
    const scene = sceneRef.current
    if (!group || !scene) return

    while (group.children.length) {
      group.remove(group.children[0])
    }

    const meshes = []

    items.forEach(it => {
      const widthMm = it.width
      const depthMm = it.depth
      const heightMm = it.height || 720

      const w = mmToMeters(widthMm)
      const d = mmToMeters(depthMm)
      const h = mmToMeters(heightMm)

      const geom = new THREE.BoxGeometry(w, h, d)
      const mat = new THREE.MeshStandardMaterial({ color: 0xdedede })
      const mesh = new THREE.Mesh(geom, mat)

      const mmX = pxToMm(it.x ?? 0)
      const mmZ = pxToMm(it.y ?? 0)

      const posX = mmToMeters(mmX + widthMm / 2 - room.width / 2)
      const posZ = mmToMeters(mmZ + depthMm / 2 - room.depth / 2)

      mesh.position.set(posX, h / 2, posZ)
      mesh.userData = {
        uid: it.uid,
        widthMm,
        depthMm,
      }

      group.add(mesh)
      meshes.push(mesh)
    })

    cabinetMeshesRef.current = meshes
  }, [items, room.width, room.depth])

  return <div ref={mountRef} className="three-canvas" />
}
