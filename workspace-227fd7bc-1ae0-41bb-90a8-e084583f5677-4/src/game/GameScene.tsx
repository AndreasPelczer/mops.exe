'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'

/* ── Constants ─────────────────────────────────── */
const MOVE_SPEED = 8
const TURN_SPEED = 3
const JUMP_FORCE = 4
const GRAVITY = -18
const CAM_HEIGHT = 2.5
const CAM_DIST = 5.5
const INTERACT_DIST = 3.5
const RAFFI_INTERACT_DIST = 5.0

/* ── Positions ─────────────────────────────────── */
const BAUWAGEN_POS   = new THREE.Vector3(0, 0, 0)
const RAFFI_INTERACT = new THREE.Vector3(0, 0, 3)    // front of Bauwagen
const PROF_POS       = new THREE.Vector3(15, 0, -10)
const CORDULA_POS    = new THREE.Vector3(-12, 0, 12)
const STEIN_POS      = new THREE.Vector3(8, 0, 22)
const SHANE_POS      = new THREE.Vector3(-130, 0, 260)

// Baustelle Alpha
const SITE1_CENTER = new THREE.Vector3(55, 0, 80)
const ARBEITER_POS  = new THREE.Vector3(55, 0, 78)

// Interaction points at Baustelle Alpha
const ZUSTAND_POS   = new THREE.Vector3(51, 0, 76)
const LIEFERUNG_POS = new THREE.Vector3(63, 0, 85)
const FOTO_POS      = new THREE.Vector3(55, 0, 82)
const PETER_POS     = new THREE.Vector3(58, 0, 84)
const AUFMASS_A_POS = new THREE.Vector3(47, 0, 76)
const AUFMASS_B_POS = new THREE.Vector3(51, 0, 76)
const AUFMASS_C_POS = new THREE.Vector3(55, 0, 76)

/* ── Types ─────────────────────────────────────── */
export interface ChecklistState {
  zustand: boolean
  nachweis: boolean
  lieferung: boolean
  uebergabe: boolean
  aufmass: boolean
}

interface Props {
  questStep: number
  checklist: ChecklistState
  aufmassWalked: string[]
  onInteract: (type: string) => void
  onRaffiInteract: () => void
  onProfessorInteract: () => void
  onCordulaInteract: () => void
  onNearChange: (obj: string | null) => void
  cordulaAwake: boolean
  chaos: boolean
}

/* ── Key state (module-level) ──────────────────── */
const keysDown = new Set<string>()

/* ── Main Scene ────────────────────────────────── */
export default function GameScene({
  questStep, checklist, aufmassWalked,
  onInteract, onRaffiInteract, onProfessorInteract, onCordulaInteract,
  onNearChange, cordulaAwake, chaos,
}: Props) {
  const playerGrp = useRef<THREE.Group>(null!)
  const tailRef   = useRef<THREE.Mesh>(null!)
  const pos       = useRef(new THREE.Vector3(0, 0, 5)) // start in front of Bauwagen
  const yaw       = useRef(0)
  const velY      = useRef(0)
  const grounded  = useRef(true)
  const t         = useRef(0)
  const prevNear  = useRef<string | null>(null)
  const { camera } = useThree()

  /* ── Keyboard ──────────────────────────────── */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (cordulaAwake) return
      keysDown.add(e.code)
      const p = pos.current

      if (e.code === 'KeyE') {
        // Raffi (always available)
        if (p.distanceTo(RAFFI_INTERACT) < RAFFI_INTERACT_DIST) { onRaffiInteract(); return }
        // Professor
        if (p.distanceTo(PROF_POS) < INTERACT_DIST) { onProfessorInteract(); return }
        // Cordula
        if (p.distanceTo(CORDULA_POS) < INTERACT_DIST) { onCordulaInteract(); return }

        // Baustelle interactions (only during active quest)
        if (questStep === 1) {
          if (!checklist.zustand && p.distanceTo(ZUSTAND_POS) < INTERACT_DIST) { onInteract('zustand'); return }
          if (!checklist.lieferung && p.distanceTo(LIEFERUNG_POS) < INTERACT_DIST) { onInteract('lieferung'); return }
          if (!checklist.uebergabe && p.distanceTo(PETER_POS) < INTERACT_DIST) { onInteract('peter'); return }
          if (!aufmassWalked.includes('A') && p.distanceTo(AUFMASS_A_POS) < INTERACT_DIST) { onInteract('aufmassA'); return }
          if (!aufmassWalked.includes('B') && p.distanceTo(AUFMASS_B_POS) < INTERACT_DIST) { onInteract('aufmassB'); return }
          if (!aufmassWalked.includes('C') && p.distanceTo(AUFMASS_C_POS) < INTERACT_DIST) { onInteract('aufmassC'); return }
        }
      }

      // F key for photo
      if (e.code === 'KeyF' && questStep === 1) {
        if (!checklist.nachweis && p.distanceTo(FOTO_POS) < INTERACT_DIST) { onInteract('foto'); return }
      }
    }
    const up = (e: KeyboardEvent) => keysDown.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [questStep, checklist, aufmassWalked, cordulaAwake,
    onInteract, onRaffiInteract, onProfessorInteract, onCordulaInteract])

  /* ── Game Loop ─────────────────────────────── */
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    t.current += dt

    if (cordulaAwake) {
      const offset = new THREE.Vector3(0, CAM_HEIGHT, -CAM_DIST)
      offset.applyAxisAngle(UP, yaw.current)
      const targetPos = pos.current.clone().add(offset)
      camera.position.lerp(targetPos, 1 - Math.pow(0.005, dt))
      camera.lookAt(pos.current.x, 0.3, pos.current.z)
      return
    }

    /* turn */
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft'))  yaw.current += TURN_SPEED * dt
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) yaw.current -= TURN_SPEED * dt

    /* move */
    const fwd = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current))
    const moving = keysDown.has('KeyW') || keysDown.has('ArrowUp') ||
                   keysDown.has('KeyS') || keysDown.has('ArrowDown')
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp'))   pos.current.addScaledVector(fwd, MOVE_SPEED * dt)
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) pos.current.addScaledVector(fwd, -MOVE_SPEED * 0.5 * dt)

    /* jump */
    if (keysDown.has('Space') && grounded.current) { velY.current = JUMP_FORCE; grounded.current = false }
    velY.current += GRAVITY * dt
    pos.current.y += velY.current * dt
    if (pos.current.y <= 0) { pos.current.y = 0; velY.current = 0; grounded.current = true }

    /* apply to group */
    playerGrp.current.position.copy(pos.current)
    playerGrp.current.rotation.y = yaw.current
    if (moving && grounded.current) {
      playerGrp.current.position.y += Math.sin(t.current * 14) * 0.025
    }

    /* tail wag */
    if (tailRef.current) {
      const wagSpeed = moving ? 10 : 3
      tailRef.current.rotation.y = Math.sin(t.current * wagSpeed) * 0.6
    }

    /* camera follow + chaos shake */
    const offset = new THREE.Vector3(0, CAM_HEIGHT, -CAM_DIST)
    offset.applyAxisAngle(UP, yaw.current)
    const targetPos = pos.current.clone().add(offset)
    if (chaos) {
      targetPos.x += Math.sin(t.current * 37) * 0.15
      targetPos.y += Math.cos(t.current * 29) * 0.1
    }
    camera.position.lerp(targetPos, 1 - Math.pow(0.005, dt))
    camera.lookAt(pos.current.x, 0.3, pos.current.z)

    /* proximity */
    const p = pos.current
    let near: string | null = null
    if (p.distanceTo(RAFFI_INTERACT) < RAFFI_INTERACT_DIST) near = 'raffi'
    else if (questStep === 1) {
      if (!checklist.zustand && p.distanceTo(ZUSTAND_POS) < INTERACT_DIST) near = 'zustand'
      else if (!checklist.nachweis && p.distanceTo(FOTO_POS) < INTERACT_DIST) near = 'foto'
      else if (!checklist.lieferung && p.distanceTo(LIEFERUNG_POS) < INTERACT_DIST) near = 'lieferung'
      else if (!checklist.uebergabe && p.distanceTo(PETER_POS) < INTERACT_DIST) near = 'peter'
      else if (!aufmassWalked.includes('A') && p.distanceTo(AUFMASS_A_POS) < INTERACT_DIST) near = 'aufmassA'
      else if (!aufmassWalked.includes('B') && p.distanceTo(AUFMASS_B_POS) < INTERACT_DIST) near = 'aufmassB'
      else if (!aufmassWalked.includes('C') && p.distanceTo(AUFMASS_C_POS) < INTERACT_DIST) near = 'aufmassC'
    }
    else if (p.distanceTo(PROF_POS) < INTERACT_DIST) near = 'professor'
    else if (!cordulaAwake && p.distanceTo(CORDULA_POS) < INTERACT_DIST) near = 'cordula'
    if (near !== prevNear.current) { prevNear.current = near; onNearChange(near) }
  })

  /* ── Render ────────────────────────────────── */
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.45} color="#FFF8E7" />
      <directionalLight position={[60, 80, 40]} intensity={1.3} color="#FFE4B5" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-far={200} shadow-camera-left={-60} shadow-camera-right={60}
        shadow-camera-top={60} shadow-camera-bottom={-60} />
      <hemisphereLight args={['#87CEEB', '#4A7023', 0.35]} />

      {/* Sky & Fog */}
      <Sky sunPosition={[100, 45, 30]} turbidity={3} rayleigh={0.5} />
      <fog attach="fog" args={['#C8DDB5', 80, 350]} />

      {/* ── Ground ───────────────────────────── */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshLambertMaterial color={chaos ? '#4A5C2E' : '#5B8C3E'} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <planeGeometry args={[700, 700, 70, 70]} />
        <meshBasicMaterial color="#528435" wireframe transparent opacity={0.06} />
      </mesh>

      {/* ── Player (Kleiner Mops / Dog) ─────── */}
      <group ref={playerGrp}>
        {/* body */}
        <mesh position-y={0.28} castShadow>
          <boxGeometry args={[0.38, 0.22, 0.24]} />
          <meshLambertMaterial color="#D4845A" />
        </mesh>
        {/* chest (slightly wider front) */}
        <mesh position={[0, 0.30, 0.04]} castShadow>
          <boxGeometry args={[0.24, 0.18, 0.20]} />
          <meshLambertMaterial color="#D4845A" />
        </mesh>
        {/* head */}
        <mesh position={[0, 0.44, 0.16]} castShadow>
          <sphereGeometry args={[0.11, 8, 6]} />
          <meshLambertMaterial color="#E8B88A" />
        </mesh>
        {/* muzzle */}
        <mesh position={[0, 0.42, 0.26]} castShadow>
          <boxGeometry args={[0.08, 0.06, 0.08]} />
          <meshLambertMaterial color="#E8C0A0" />
        </mesh>
        {/* nose */}
        <mesh position={[0, 0.43, 0.31]}>
          <sphereGeometry args={[0.02, 6, 4]} />
          <meshBasicMaterial color="#222" />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.04, 0.47, 0.24]}>
          <sphereGeometry args={[0.02, 6, 4]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        <mesh position={[0.04, 0.47, 0.24]}>
          <sphereGeometry args={[0.02, 6, 4]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        {/* ears (floppy) */}
        <mesh position={[-0.09, 0.50, 0.12]} rotation-z={0.4} rotation-x={-0.2}>
          <boxGeometry args={[0.06, 0.10, 0.03]} />
          <meshLambertMaterial color="#B8734A" />
        </mesh>
        <mesh position={[0.09, 0.50, 0.12]} rotation-z={-0.4} rotation-x={-0.2}>
          <boxGeometry args={[0.06, 0.10, 0.03]} />
          <meshLambertMaterial color="#B8734A" />
        </mesh>
        {/* front legs */}
        <mesh position={[-0.10, 0.08, 0.08]} castShadow>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color="#C47A4F" />
        </mesh>
        <mesh position={[0.10, 0.08, 0.08]} castShadow>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color="#C47A4F" />
        </mesh>
        {/* back legs */}
        <mesh position={[-0.10, 0.08, -0.08]} castShadow>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color="#C47A4F" />
        </mesh>
        <mesh position={[0.10, 0.08, -0.08]} castShadow>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color="#C47A4F" />
        </mesh>
        {/* tail (curled up, wagging) */}
        <mesh ref={tailRef} position={[0, 0.38, -0.16]} rotation-x={-0.8}>
          <cylinderGeometry args={[0.015, 0.02, 0.12, 6]} />
          <meshLambertMaterial color="#B8734A" />
        </mesh>
      </group>

      {/* ── Bauwagen ──────────────────────────── */}
      <Bauwagen />

      {/* ── Baustelle Alpha ───────────────────── */}
      <BaustelleAlpha />
      {/* ── Interaction Markers at Baustelle ── */}
      {questStep === 1 && (
        <>
          <InteractionMarker position={ZUSTAND_POS} type="zustand" done={checklist.zustand} />
          <InteractionMarker position={FOTO_POS} type="foto" done={checklist.nachweis} />
          <InteractionMarker position={LIEFERUNG_POS} type="lieferung" done={checklist.lieferung} />
          <AufmassMarker position={AUFMASS_A_POS} label="A" done={aufmassWalked.includes('A')} />
          <AufmassMarker position={AUFMASS_B_POS} label="B" done={aufmassWalked.includes('B')} />
          <AufmassMarker position={AUFMASS_C_POS} label="C" done={aufmassWalked.includes('C')} />
          <Peter position={[PETER_POS.x, 0, PETER_POS.z]} />
        </>
      )}
      {/* Bauarbeiter */}
      <Bauarbeiter position={[ARBEITER_POS.x, 0, ARBEITER_POS.z]} />

      {/* ── Professor Mops ───────────────────── */}
      <group position={[PROF_POS.x, 0, PROF_POS.z]} rotation-y={0.3}>
        <mesh position-y={1.05} castShadow><boxGeometry args={[0.5, 0.85, 0.35]} /><meshLambertMaterial color="#4A5D3A" /></mesh>
        <mesh position-y={1.1} castShadow><boxGeometry args={[0.54, 0.55, 0.39]} /><meshLambertMaterial color="#6B4423" /></mesh>
        <mesh position={[-0.35, 0.95, 0]}><boxGeometry args={[0.08, 0.1, 0.08]} /><meshLambertMaterial color="#8B6B3D" /></mesh>
        <mesh position={[0.35, 0.95, 0]}><boxGeometry args={[0.08, 0.1, 0.08]} /><meshLambertMaterial color="#8B6B3D" /></mesh>
        <mesh position-y={1.7} castShadow><sphereGeometry args={[0.22, 8, 6]} /><meshLambertMaterial color="#E8C8A0" /></mesh>
        <mesh position={[-0.09, 1.74, 0.18]}><boxGeometry args={[0.07, 0.05, 0.02]} /><meshBasicMaterial color="#333" /></mesh>
        <mesh position={[0.09, 1.74, 0.18]}><boxGeometry args={[0.07, 0.05, 0.02]} /><meshBasicMaterial color="#333" /></mesh>
        <mesh position={[0, 1.74, 0.19]}><boxGeometry args={[0.04, 0.015, 0.02]} /><meshBasicMaterial color="#333" /></mesh>
        <mesh position-y={1.88} castShadow><cylinderGeometry args={[0.28, 0.22, 0.1, 8]} /><meshLambertMaterial color="#3A2F1E" /></mesh>
        <mesh position={[0, 1.84, 0.05]} castShadow><boxGeometry args={[0.55, 0.04, 0.2]} /><meshLambertMaterial color="#3A2F1E" /></mesh>
        <mesh position={[-0.09, 1.73, 0.19]}><sphereGeometry args={[0.025, 6, 4]} /><meshBasicMaterial color="#224" /></mesh>
        <mesh position={[0.09, 1.73, 0.19]}><sphereGeometry args={[0.025, 6, 4]} /><meshBasicMaterial color="#224" /></mesh>
        <mesh position={[0, 1.6, 0.17]}><boxGeometry args={[0.14, 0.08, 0.06]} /><meshLambertMaterial color="#B8B8B8" /></mesh>
        <mesh position={[-0.12, 0.3, 0]} castShadow><boxGeometry args={[0.15, 0.5, 0.15]} /><meshLambertMaterial color="#3D3D2E" /></mesh>
        <mesh position={[0.12, 0.3, 0]} castShadow><boxGeometry args={[0.15, 0.5, 0.15]} /><meshLambertMaterial color="#3D3D2E" /></mesh>
        <mesh position={[-0.35, 1.0, 0]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} /><meshLambertMaterial color="#4A5D3A" /></mesh>
        <mesh position={[0.32, 0.85, 0.15]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} /><meshLambertMaterial color="#4A5D3A" /></mesh>
        <mesh position={[0.38, 0.65, 0.22]} rotation-z={0.15}><boxGeometry args={[0.2, 0.28, 0.04]} /><meshLambertMaterial color="#8B4513" /></mesh>
        <mesh position={[0, 2.2, 0]} rotation-x={-0.25}><boxGeometry args={[0.9, 0.14, 0.02]} /><meshBasicMaterial color="#1A1A1A" /></mesh>
      </group>

      {/* ── Cordula.py ───────────────────────── */}
      <group position={[CORDULA_POS.x, 0, CORDULA_POS.z]} rotation-y={-0.5}>
        <mesh position={[0, 0.45, 0]} rotation-x={cordulaAwake ? 0.05 : 0.3} castShadow>
          <boxGeometry args={[0.45, 0.7, 0.35]} /><meshLambertMaterial color="#2D3748" />
        </mesh>
        <mesh position={[0.05, cordulaAwake ? 1.05 : 0.9, cordulaAwake ? 0.05 : 0.25]} rotation-x={cordulaAwake ? 0 : 0.8} castShadow>
          <sphereGeometry args={[0.2, 8, 6]} /><meshLambertMaterial color="#F0D0B0" />
        </mesh>
        <mesh position={[0.05, cordulaAwake ? 1.18 : 1.02, cordulaAwake ? 0 : 0.2]} rotation-x={cordulaAwake ? 0 : 0.8}>
          <boxGeometry args={[0.35, 0.15, 0.3]} /><meshLambertMaterial color="#4A2800" />
        </mesh>
        {cordulaAwake ? (
          <>
            <mesh position={[-0.02, 1.08, 0.2]}><sphereGeometry args={[0.025, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
            <mesh position={[0.1, 1.08, 0.2]}><sphereGeometry args={[0.025, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
          </>
        ) : (
          <>
            <mesh position={[-0.05, 0.93, 0.4]} rotation-x={0.8}><boxGeometry args={[0.06, 0.01, 0.01]} /><meshBasicMaterial color="#333" /></mesh>
            <mesh position={[0.1, 0.93, 0.4]} rotation-x={0.8}><boxGeometry args={[0.06, 0.01, 0.01]} /><meshBasicMaterial color="#333" /></mesh>
          </>
        )}
        <mesh position={[0, 0.12, 0.35]} castShadow><boxGeometry args={[0.35, 0.12, 0.5]} /><meshLambertMaterial color="#1A202C" /></mesh>
        <mesh position={[0, 0.75, 0.15]} rotation-x={-0.1} castShadow><boxGeometry args={[0.4, 0.02, 0.28]} /><meshLambertMaterial color="#555" /></mesh>
        <mesh position={[0, 0.95, 0.02]} rotation-x={-0.6} castShadow>
          <boxGeometry args={[0.38, 0.25, 0.015]} /><meshBasicMaterial color={cordulaAwake ? '#0A4A0A' : '#1A3A1A'} />
        </mesh>
        <pointLight position={[0, 0.95, 0.05]} color="#00FF41" intensity={cordulaAwake ? 0.4 : 0.15} distance={cordulaAwake ? 2.5 : 1.5} />
        {!cordulaAwake && <CordulaZParticles />}
      </group>

      {/* ── Der Stein ────────────────────────── */}
      <group position={[STEIN_POS.x, 0, STEIN_POS.z]}>
        <mesh position={[0, 0.2, 0]} castShadow><dodecahedronGeometry args={[0.3, 0]} /><meshLambertMaterial color="#7A7A6E" /></mesh>
        <mesh position={[0.15, 0.12, 0.1]} castShadow><dodecahedronGeometry args={[0.15, 0]} /><meshLambertMaterial color="#8A8A7E" /></mesh>
        <mesh position={[-0.1, 0.1, -0.12]}><dodecahedronGeometry args={[0.12, 0]} /><meshLambertMaterial color="#6E6E62" /></mesh>
      </group>

      {/* ── Die Shanehaube (Secret) ──────────── */}
      <group position={[SHANE_POS.x, 0, SHANE_POS.z]} rotation-y={0.4}>
        <mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[0.8, 0.35, 0.5]} /><meshLambertMaterial color="#8B6914" /></mesh>
        <mesh position={[0, 0.48, 0]}><boxGeometry args={[0.7, 0.24, 0.4]} /><meshLambertMaterial color="#6B4F12" /></mesh>
        <mesh position={[0, 0.18, 0.32]} rotation-x={Math.PI / 2}><torusGeometry args={[0.17, 0.035, 6, 12]} /><meshLambertMaterial color="#333" /></mesh>
        <mesh position={[0, 0.18, 0.32]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.015, 0.015, 0.5, 6]} /><meshLambertMaterial color="#444" /></mesh>
        <mesh position={[-0.25, 0.14, -0.18]} castShadow><boxGeometry args={[0.05, 0.28, 0.05]} /><meshLambertMaterial color="#555" /></mesh>
        <mesh position={[0.25, 0.14, -0.18]} castShadow><boxGeometry args={[0.05, 0.28, 0.05]} /><meshLambertMaterial color="#555" /></mesh>
        <mesh position={[-0.15, 0.48, -0.42]} rotation-x={0.3}><cylinderGeometry args={[0.018, 0.018, 0.5, 6]} /><meshLambertMaterial color="#6B4F12" /></mesh>
        <mesh position={[0.15, 0.48, -0.42]} rotation-x={0.3}><cylinderGeometry args={[0.018, 0.018, 0.5, 6]} /><meshLambertMaterial color="#6B4F12" /></mesh>
        <mesh position={[0, 0.68, 0]} castShadow><sphereGeometry args={[0.065, 8, 6]} /><meshLambertMaterial color="#DC143C" /></mesh>
        <mesh position={[0.02, 0.78, 0.02]}><cylinderGeometry args={[0.007, 0.007, 0.14, 4]} /><meshLambertMaterial color="#228B22" /></mesh>
        <mesh position={[0.025, 0.71, 0.04]}><sphereGeometry args={[0.018, 6, 4]} /><meshBasicMaterial color="#FF6B6B" transparent opacity={0.7} /></mesh>
      </group>

      {/* ── Trees ─────────────────────────────── */}
      <LowPolyTree pos={[-8, 0, 35]} scale={1.1} />
      <LowPolyTree pos={[15, 0, 45]} scale={0.9} />
      <LowPolyTree pos={[-20, 0, 60]} scale={1.3} />
      <LowPolyTree pos={[30, 0, 55]} scale={1.0} />
      <LowPolyTree pos={[-35, 0, 85]} scale={1.2} />
      <LowPolyTree pos={[5, 0, 120]} scale={0.8} />
      <LowPolyTree pos={[-15, 0, 140]} scale={1.1} />
      <LowPolyTree pos={[25, 0, 130]} scale={1.4} />
      <LowPolyTree pos={[-10, 0, 15]} scale={0.7} />
      <LowPolyTree pos={[35, 0, 20]} scale={1.0} />
      <LowPolyTree pos={[-40, 0, 40]} scale={1.5} />
      <LowPolyTree pos={[70, 0, 90]} scale={0.9} />
      <LowPolyTree pos={[40, 0, 100]} scale={1.1} />
      <LowPolyTree pos={[75, 0, 70]} scale={1.0} />

      {/* ── Path Markers ──────────────────────── */}
      <PathMarker pos={[3, 0, 15]} />
      <PathMarker pos={[15, 0, 30]} />
      <PathMarker pos={[25, 0, 50]} />
      <PathMarker pos={[35, 0, 65]} />
      <PathMarker pos={[45, 0, 75]} />

      {/* ── Decorative Rocks ──────────────────── */}
      <mesh position={[-12, 0.08, 50]} castShadow><dodecahedronGeometry args={[0.18, 0]} /><meshLambertMaterial color="#7A7A6E" /></mesh>
      <mesh position={[18, 0.06, 65]} castShadow><dodecahedronGeometry args={[0.12, 0]} /><meshLambertMaterial color="#8A8A7E" /></mesh>
      <mesh position={[-28, 0.1, 95]} castShadow><dodecahedronGeometry args={[0.22, 0]} /><meshLambertMaterial color="#6E6E62" /></mesh>

      {/* ── Wind Particles ─────────────────────── */}
      <WindParticles />
    </>
  )
}

/* ═══════════════════════════════════════════════ */
/* ── Sub-components ────────────────────────────── */
/* ═══════════════════════════════════════════════ */

const UP = new THREE.Vector3(0, 1, 0)

/* ── Bauwagen (Construction Trailer) ─────────── */
function Bauwagen() {
  const blinkRef = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (blinkRef.current) {
      const on = Math.sin(clock.getElapsedTime() * 4) > 0
      blinkRef.current.visible = on
    }
  })
  return (
    <group position={[BAUWAGEN_POS.x, 0, BAUWAGEN_POS.z]}>
      {/* floor (wooden frame) */}
      <mesh position-y={0.06} receiveShadow><boxGeometry args={[4.0, 0.12, 2.2]} /><meshLambertMaterial color="#8B7355" /></mesh>
      {/* undercarriage / frame rails */}
      <mesh position={[0, -0.02, 0]}><boxGeometry args={[4.2, 0.06, 0.12]} /><meshLambertMaterial color="#555" /></mesh>
      <mesh position={[0, -0.02, -0.8]}><boxGeometry args={[4.2, 0.06, 0.12]} /><meshLambertMaterial color="#555" /></mesh>
      {/* axle */}
      <mesh position={[0, -0.15, 0.6]}><boxGeometry args={[0.08, 0.08, 1.4]} /><meshLambertMaterial color="#444" /></mesh>
      {/* wheels (back) */}
      <group position={[0, -0.15, 0.6]}>
        <mesh position={[-0.7, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.22, 0.22, 0.1, 12]} /><meshLambertMaterial color="#222" /></mesh>
        <mesh position={[0.7, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.22, 0.22, 0.1, 12]} /><meshLambertMaterial color="#222" /></mesh>
      </group>

      {/* Stuetzfuesser (4 corners) */}
      <mesh position={[-1.8, -0.1, -0.9]}><boxGeometry args={[0.06, 0.2, 0.06]} /><meshLambertMaterial color="#666" /></mesh>
      <mesh position={[-1.8, -0.2, -0.9]}><boxGeometry args={[0.14, 0.04, 0.14]} /><meshLambertMaterial color="#555" /></mesh>
      <mesh position={[1.8, -0.1, -0.9]}><boxGeometry args={[0.06, 0.2, 0.06]} /><meshLambertMaterial color="#666" /></mesh>
      <mesh position={[1.8, -0.2, -0.9]}><boxGeometry args={[0.14, 0.04, 0.14]} /><meshLambertMaterial color="#555" /></mesh>
      <mesh position={[-1.8, -0.1, 0.9]}><boxGeometry args={[0.06, 0.2, 0.06]} /><meshLambertMaterial color="#666" /></mesh>
      <mesh position={[-1.8, -0.2, 0.9]}><boxGeometry args={[0.14, 0.04, 0.14]} /><meshLambertMaterial color="#555" /></mesh>
      <mesh position={[1.8, -0.1, 0.9]}><boxGeometry args={[0.06, 0.2, 0.06]} /><meshLambertMaterial color="#666" /></mesh>
      <mesh position={[1.8, -0.2, 0.9]}><boxGeometry args={[0.14, 0.04, 0.14]} /><meshLambertMaterial color="#555" /></mesh>

      {/* back wall */}
      <mesh position={[0, 1.2, -0.95]} castShadow><boxGeometry args={[4.0, 2.2, 0.1]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
      {/* left wall */}
      <mesh position={[-1.95, 1.2, 0]} castShadow><boxGeometry args={[0.1, 2.2, 2.0]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
      {/* right wall */}
      <mesh position={[1.95, 1.2, 0]} castShadow><boxGeometry args={[0.1, 2.2, 2.0]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
      {/* roof */}
      <mesh position-y={2.36} castShadow><boxGeometry args={[4.3, 0.12, 2.4]} /><meshLambertMaterial color="#6B6B6B" /></mesh>
      {/* roof ridge (slight angle) */}
      <mesh position-y={2.42}><boxGeometry args={[4.3, 0.06, 0.3]} /><meshLambertMaterial color="#5A5A5A" /></mesh>

      {/* left window (with frame) */}
      <mesh position={[-1.96, 1.4, 0]}><boxGeometry args={[0.02, 0.6, 0.8]} /><meshBasicMaterial color="#87CEEB" transparent opacity={0.5} /></mesh>
      <mesh position={[-1.97, 1.4, 0]}><boxGeometry args={[0.03, 0.7, 0.04]} /><meshLambertMaterial color="#888" /></mesh>
      <mesh position={[-1.97, 1.4, 0]}><boxGeometry args={[0.03, 0.04, 0.9]} /><meshLambertMaterial color="#888" /></mesh>
      {/* right window (with frame) */}
      <mesh position={[1.96, 1.4, 0]}><boxGeometry args={[0.02, 0.6, 0.8]} /><meshBasicMaterial color="#87CEEB" transparent opacity={0.5} /></mesh>
      <mesh position={[1.97, 1.4, 0]}><boxGeometry args={[0.03, 0.7, 0.04]} /><meshLambertMaterial color="#888" /></mesh>
      <mesh position={[1.97, 1.4, 0]}><boxGeometry args={[0.03, 0.04, 0.9]} /><meshLambertMaterial color="#888" /></mesh>

      {/* front wall strip (sides of door opening) */}
      <mesh position={[-1.2, 1.2, 0.95]}><boxGeometry args={[0.6, 2.2, 0.1]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
      <mesh position={[1.2, 1.2, 0.95]}><boxGeometry args={[0.6, 2.2, 0.1]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
      {/* door frame top */}
      <mesh position={[0, 2.2, 0.95]}><boxGeometry args={[1.4, 0.15, 0.1]} /><meshLambertMaterial color="#C0B498" /></mesh>

      {/* counter/desk inside */}
      <mesh position={[0, 0.5, -0.5]} castShadow><boxGeometry args={[2.5, 0.8, 0.5]} /><meshLambertMaterial color="#8B6914" /></mesh>
      {/* counter top */}
      <mesh position={[0, 0.92, -0.5]}><boxGeometry args={[2.6, 0.04, 0.55]} /><meshLambertMaterial color="#A07828" /></mesh>

      {/* papers on desk */}
      <mesh position={[-0.4, 0.96, -0.4]} rotation-y={0.2}><boxGeometry args={[0.25, 0.01, 0.18]} /><meshLambertMaterial color="#F5F0E0" /></mesh>
      <mesh position={[-0.15, 0.97, -0.35]} rotation-y={-0.1}><boxGeometry args={[0.22, 0.01, 0.16]} /><meshLambertMaterial color="#E8E0D0" /></mesh>
      {/* coffee mug on desk */}
      <mesh position={[0.5, 0.99, -0.4]}><cylinderGeometry args={[0.03, 0.025, 0.06, 8]} /><meshLambertMaterial color="#8B4513" /></mesh>

      {/* ── Raffi (behind counter) ─────────── */}
      <group position={[0, 0.12, -0.5]} rotation-y={Math.PI}>
        <mesh position-y={1.0} castShadow><boxGeometry args={[0.5, 0.9, 0.35]} /><meshLambertMaterial color="#6B7B8D" /></mesh>
        <mesh position-y={1.1} castShadow><boxGeometry args={[0.54, 0.5, 0.39]} /><meshLambertMaterial color="#E8842A" /></mesh>
        <mesh position={[0, 1.0, 0.2]}><boxGeometry args={[0.5, 0.04, 0.01]} /><meshBasicMaterial color="#FFD700" /></mesh>
        <mesh position={[0, 1.15, 0.2]}><boxGeometry args={[0.5, 0.04, 0.01]} /><meshBasicMaterial color="#FFD700" /></mesh>
        <mesh position-y={1.68} castShadow><sphereGeometry args={[0.22, 8, 6]} /><meshLambertMaterial color="#F0C8A0" /></mesh>
        <mesh position-y={1.88} castShadow><cylinderGeometry args={[0.18, 0.27, 0.12, 8]} /><meshLambertMaterial color="#FF6B35" /></mesh>
        <mesh position={[-0.08, 1.72, 0.18]}><sphereGeometry args={[0.03, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[0.08, 1.72, 0.18]}><sphereGeometry args={[0.03, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[0, 1.63, 0.2]}><boxGeometry args={[0.16, 0.03, 0.04]} /><meshLambertMaterial color="#5A3E28" /></mesh>
        <mesh position={[-0.12, 0.3, 0]} castShadow><boxGeometry args={[0.15, 0.5, 0.15]} /><meshLambertMaterial color="#4A5568" /></mesh>
        <mesh position={[0.12, 0.3, 0]} castShadow><boxGeometry args={[0.15, 0.5, 0.15]} /><meshLambertMaterial color="#4A5568" /></mesh>
        <mesh position={[-0.35, 1.0, 0]} castShadow><boxGeometry args={[0.12, 0.55, 0.12]} /><meshLambertMaterial color="#6B7B8D" /></mesh>
        <mesh position={[0.35, 1.0, 0]} castShadow><boxGeometry args={[0.12, 0.55, 0.12]} /><meshLambertMaterial color="#6B7B8D" /></mesh>
      </group>

      {/* BAULEITUNG sign (above door) */}
      <mesh position={[0, 1.9, 0.98]}><boxGeometry args={[1.6, 0.2, 0.02]} /><meshBasicMaterial color="#1A1A1A" /></mesh>
      {/* iMOPS mini-logo on sign */}
      <mesh position={[0, 1.9, 0.995]}><boxGeometry args={[0.5, 0.1, 0.01]} /><meshBasicMaterial color="#E8842A" /></mesh>

      {/* step */}
      <mesh position={[0, 0.06, 1.4]}><boxGeometry args={[1.2, 0.12, 0.6]} /><meshLambertMaterial color="#888" /></mesh>
      {/* step 2 */}
      <mesh position={[0, 0.12, 1.65]}><boxGeometry args={[1.0, 0.06, 0.3]} /><meshLambertMaterial color="#777" /></mesh>

      {/* small awning over door */}
      <mesh position={[0, 2.15, 1.2]}><boxGeometry args={[1.8, 0.04, 0.6]} /><meshLambertMaterial color="#8B7355" /></mesh>
      {/* awning supports */}
      <mesh position={[-0.8, 1.6, 1.4]}><boxGeometry args={[0.04, 0.6, 0.04]} /><meshLambertMaterial color="#6B5B45" /></mesh>
      <mesh position={[0.8, 1.6, 1.4]}><boxGeometry args={[0.04, 0.6, 0.04]} /><meshLambertMaterial color="#6B5B45" /></mesh>

      {/* blinking lamp on awning */}
      <mesh position={[0, 2.25, 1.45]}><boxGeometry args={[0.12, 0.12, 0.12]} /><meshLambertMaterial color="#555" /></mesh>
      <mesh ref={blinkRef} position={[0, 2.35, 1.45]}><sphereGeometry args={[0.06, 6, 4]} /><meshBasicMaterial color="#FFD700" /></mesh>
      <pointLight position={[0, 2.35, 1.45]} color="#FFD700" intensity={0.5} distance={5} />

      {/* Baustellenschild next to Bauwagen */}
      <group position={[3.2, 0, 1.5]}>
        <mesh position-y={0.8}><boxGeometry args={[0.06, 1.6, 0.06]} /><meshLambertMaterial color="#888" /></mesh>
        <mesh position-y={1.55}><boxGeometry args={[1.8, 0.6, 0.04]} /><meshLambertMaterial color="#E8842A" /></mesh>
        <mesh position-y={1.55}><boxGeometry args={[1.5, 0.06, 0.02]} /><meshBasicMaterial color="#FFF" /></mesh>
        {/* tiny blinker on sign */}
        <mesh position={[0, 1.9, 0]}><boxGeometry args={[0.08, 0.15, 0.08]} /><meshLambertMaterial color="#444" /></mesh>
        <mesh position={[0, 1.98, 0]}><sphereGeometry args={[0.035, 6, 4]} /><meshBasicMaterial color="#FF4500" /></mesh>
        <pointLight position={[0, 1.98, 0]} color="#FF4500" intensity={0.3} distance={3} />
      </group>

      {/* interior light */}
      <pointLight position={[0, 1.8, -0.3]} color="#FFE4B5" intensity={0.6} distance={4} />
      {/* door light cone (spill light) */}
      <pointLight position={[0, 1.0, 1.2]} color="#FFE4B5" intensity={0.3} distance={4} />

      {/* Paletten vor dem Bauwagen */}
      <Baupalette position={[-2.5, 0, 2.8]} />
      <Baupalette position={[-1.0, 0, 3.2]} rotation={0.15} />
      {/* sand/lime sack on palette */}
      <mesh position={[-2.5, 0.18, 2.8]}><boxGeometry args={[0.35, 0.25, 0.35]} /><meshLambertMaterial color="#C8B88A" /></mesh>
      <mesh position={[-1.0, 0.18, 3.2]} rotation-y={0.15}><boxGeometry args={[0.3, 0.22, 0.3]} /><meshLambertMaterial color="#D4C8B0" /></mesh>
    </group>
  )
}

/* ── Aufmass Marker (small numbered pole) ────── */
function AufmassMarker({ position, label, done }: { position: THREE.Vector3; label: string; done: boolean }) {
  const color = done ? '#4CAF50' : '#00BCD4'
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position-y={0.4}><cylinderGeometry args={[0.025, 0.025, 0.8, 6]} /><meshLambertMaterial color={color} /></mesh>
      <mesh position-y={0.85}><boxGeometry args={[0.18, 0.18, 0.04]} /><meshBasicMaterial color={color} /></mesh>
      <pointLight position-y={0.85} color={color} intensity={done ? 0.15 : 0.4} distance={3} />
      {/* ground ring */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.3, 0.35, 12]} />
        <meshBasicMaterial color={color} transparent opacity={done ? 0.1 : 0.25} />
      </mesh>
    </group>
  )
}

/* ── Interaction Marker (floating icon) ───────── */
function InteractionMarker({ position, type, done }: { position: THREE.Vector3; type: string; done: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const colorMap: Record<string, string> = { zustand: '#FFD700', foto: '#FFFFFF', lieferung: '#A0522D' }
  const color = colorMap[type] || '#FFD700'
  const floatColor = done ? '#4CAF50' : color

  useFrame(({ clock }) => {
    if (ref.current && !done) {
      ref.current.position.y = 1.2 + Math.sin(clock.getElapsedTime() * 2) * 0.1
    }
  })

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={ref} position-y={1.2}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshBasicMaterial color={floatColor} transparent opacity={done ? 0.3 : 0.8} />
      </mesh>
      <pointLight position-y={1.2} color={floatColor} intensity={done ? 0.15 : 0.5} distance={3} />
      {/* ground glow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.5, 12]} />
        <meshBasicMaterial color={floatColor} transparent opacity={done ? 0.05 : 0.12} />
      </mesh>
    </group>
  )
}

/* ── Peter (Bauarbeiter mit Namensschild) ─────── */
function Peter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={-0.3}>
      {/* body */}
      <mesh position-y={0.85} castShadow><boxGeometry args={[0.38, 0.5, 0.24]} /><meshLambertMaterial color="#4A6FA5" /></mesh>
      {/* vest (red to distinguish) */}
      <mesh position-y={0.90} castShadow><boxGeometry args={[0.42, 0.45, 0.28]} /><meshLambertMaterial color="#CC3333" /></mesh>
      {/* vest stripes */}
      <mesh position={[0, 0.80, 0.145]}><boxGeometry args={[0.40, 0.04, 0.01]} /><meshBasicMaterial color="#FF6666" /></mesh>
      <mesh position={[0, 1.00, 0.145]}><boxGeometry args={[0.40, 0.04, 0.01]} /><meshBasicMaterial color="#FF6666" /></mesh>
      {/* head */}
      <mesh position-y={1.40} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshLambertMaterial color="#E8C8A0" /></mesh>
      {/* helmet (white for Peter) */}
      <mesh position-y={1.52} castShadow><cylinderGeometry args={[0.16, 0.17, 0.06, 8]} /><meshLambertMaterial color="#EEEEEE" /></mesh>
      <mesh position={[0, 1.50, 0.10]}><boxGeometry args={[0.30, 0.03, 0.12]} /><meshLambertMaterial color="#EEEEEE" /></mesh>
      {/* eyes */}
      <mesh position={[-0.05, 1.42, 0.12]}><sphereGeometry args={[0.02, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh position={[0.05, 1.42, 0.12]}><sphereGeometry args={[0.02, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
      {/* legs */}
      <mesh position={[-0.10, 0.25, 0]} castShadow><boxGeometry args={[0.14, 0.50, 0.14]} /><meshLambertMaterial color="#4A5568" /></mesh>
      <mesh position={[0.10, 0.25, 0]} castShadow><boxGeometry args={[0.14, 0.50, 0.14]} /><meshLambertMaterial color="#4A5568" /></mesh>
      {/* arms */}
      <mesh position={[-0.28, 0.85, 0]} castShadow><boxGeometry args={[0.12, 0.50, 0.12]} /><meshLambertMaterial color="#CC3333" /></mesh>
      <mesh position={[0.28, 0.85, 0]} castShadow><boxGeometry args={[0.12, 0.50, 0.12]} /><meshLambertMaterial color="#CC3333" /></mesh>
      {/* boots */}
      <mesh position={[-0.10, 0.04, 0.02]}><boxGeometry args={[0.15, 0.08, 0.20]} /><meshLambertMaterial color="#333" /></mesh>
      <mesh position={[0.10, 0.04, 0.02]}><boxGeometry args={[0.15, 0.08, 0.20]} /><meshLambertMaterial color="#333" /></mesh>
      {/* name tag on vest */}
      <mesh position={[0, 1.05, 0.145]}><boxGeometry args={[0.2, 0.08, 0.01]} /><meshBasicMaterial color="#FFFF00" /></mesh>
    </group>
  )
}

/* ── Baustelle Alpha ──────────────────────────── */
function BaustelleAlpha() {
  return (
    <group position={[SITE1_CENTER.x, 0, SITE1_CENTER.z]}>
      {/* ground area (sand/gravel) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow>
        <planeGeometry args={[30, 25]} />
        <meshLambertMaterial color="#C4A870" />
      </mesh>

      {/* half wall (concrete) */}
      <mesh position={[-4, 1.25, -5]} castShadow>
        <boxGeometry args={[10, 2.5, 0.3]} />
        <meshLambertMaterial color="#A0A0A0" />
      </mesh>
      {/* wall top edge */}
      <mesh position={[-4, 2.52, -5]}>
        <boxGeometry args={[10.2, 0.06, 0.35]} />
        <meshLambertMaterial color="#888" />
      </mesh>

      {/* scaffolding */}
      {/* vertical poles */}
      <mesh position={[-6, 1.5, -4.5]}><cylinderGeometry args={[0.04, 0.04, 3, 6]} /><meshLambertMaterial color="#B8734A" /></mesh>
      <mesh position={[-2, 1.5, -4.5]}><cylinderGeometry args={[0.04, 0.04, 3, 6]} /><meshLambertMaterial color="#B8734A" /></mesh>
      <mesh position={[-6, 1.5, -5.5]}><cylinderGeometry args={[0.04, 0.04, 3, 6]} /><meshLambertMaterial color="#B8734A" /></mesh>
      <mesh position={[-2, 1.5, -5.5]}><cylinderGeometry args={[0.04, 0.04, 3, 6]} /><meshLambertMaterial color="#B8734A" /></mesh>
      {/* platforms */}
      <mesh position={[-4, 1.5, -5]}><boxGeometry args={[4.5, 0.06, 1.2]} /><meshLambertMaterial color="#DEB887" /></mesh>
      <mesh position={[-4, 2.5, -5]}><boxGeometry args={[4.5, 0.06, 1.2]} /><meshLambertMaterial color="#DEB887" /></mesh>
      {/* scaffolding diagonal brace */}
      <mesh position={[-4, 1.5, -5]} rotation-y={0.6}><boxGeometry args={[0.03, 3.5, 0.03]} /><meshLambertMaterial color="#A06030" /></mesh>

      {/* material pile 1 (wood planks) */}
      <mesh position={[5, 0.2, 3]} castShadow><boxGeometry args={[1.2, 0.4, 0.8]} /><meshLambertMaterial color="#8B6914" /></mesh>
      <mesh position={[5, 0.55, 3]} castShadow><boxGeometry args={[1.0, 0.3, 0.7]} /><meshLambertMaterial color="#A07828" /></mesh>

      {/* material pile 2 (bricks) */}
      <mesh position={[7, 0.15, -2]} castShadow><boxGeometry args={[0.8, 0.3, 0.6]} /><meshLambertMaterial color="#A0522D" /></mesh>
      <mesh position={[7, 0.15, -1.2]} castShadow><boxGeometry args={[0.8, 0.3, 0.6]} /><meshLambertMaterial color="#CD853F" /></mesh>

      {/* Paletten with materials */}
      <Baupalette position={[-8, 0, 4]} />
      <mesh position={[-8, 0.18, 4]}><boxGeometry args={[0.8, 0.3, 0.6]} /><meshLambertMaterial color="#888" /></mesh>
      <Baupalette position={[-6.5, 0, 4.5]} rotation={0.3} />
      <mesh position={[-6.5, 0.18, 4.5]} rotation-y={0.3}><boxGeometry args={[0.7, 0.25, 0.5]} /><meshLambertMaterial color="#999" /></mesh>
      <Baupalette position={[8, 0, 5]} />
      <mesh position={[8, 0.18, 5]}><boxGeometry args={[0.9, 0.35, 0.6]} /><meshLambertMaterial color="#A0522D" /></mesh>
      <mesh position={[8, 0.48, 5]}><boxGeometry args={[0.8, 0.3, 0.55]} /><meshLambertMaterial color="#B8703D" /></mesh>

      {/* cement bags pile */}
      <mesh position={[3, 0.12, 6]}><boxGeometry args={[0.6, 0.24, 0.4]} /><meshLambertMaterial color="#C8B88A" /></mesh>
      <mesh position={[3.3, 0.32, 6.1]}><boxGeometry args={[0.5, 0.2, 0.35]} /><meshLambertMaterial color="#BDB07A" /></mesh>

      {/* steel rebar bundles */}
      <mesh position={[10, 0.12, -5]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.15, 0.15, 2.5, 8]} /><meshLambertMaterial color="#8B4513" /></mesh>
      <mesh position={[10, 0.12, -4]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.15, 0.15, 2.5, 8]} /><meshLambertMaterial color="#A0502A" /></mesh>

      {/* site sign */}
      <mesh position={[0, 1.0, 8]}><boxGeometry args={[0.06, 1.8, 0.06]} /><meshLambertMaterial color="#888" /></mesh>
      <mesh position={[0, 1.7, 8]}><boxGeometry args={[2.0, 0.5, 0.04]} /><meshBasicMaterial color="#E8842A" /></mesh>

      {/* warning barrier tape (posts + beam) */}
      <mesh position={[-12, 0.4, 10]}><cylinderGeometry args={[0.03, 0.03, 0.8, 6]} /><meshLambertMaterial color="#FF8C00" /></mesh>
      <mesh position={[-8, 0.4, 10]}><cylinderGeometry args={[0.03, 0.03, 0.8, 6]} /><meshLambertMaterial color="#FF8C00" /></mesh>
      <mesh position={[-10, 0.7, 10]}><boxGeometry args={[4.2, 0.08, 0.08]} /><meshLambertMaterial color="#FFD700" /></mesh>
    </group>
  )
}

/* ── Baupalette (Pallet) ───────────────────────── */
function Baupalette({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      {/* deck */}
      <mesh position-y={0.06} castShadow><boxGeometry args={[1.0, 0.04, 0.7]} /><meshLambertMaterial color="#C4A060" /></mesh>
      {/* support blocks */}
      <mesh position={[-0.35, 0.03, -0.2]}><boxGeometry args={[0.1, 0.06, 0.15]} /><meshLambertMaterial color="#A08040" /></mesh>
      <mesh position={[0.35, 0.03, -0.2]}><boxGeometry args={[0.1, 0.06, 0.15]} /><meshLambertMaterial color="#A08040" /></mesh>
      <mesh position={[-0.35, 0.03, 0.2]}><boxGeometry args={[0.1, 0.06, 0.15]} /><meshLambertMaterial color="#A08040" /></mesh>
      <mesh position={[0.35, 0.03, 0.2]}><boxGeometry args={[0.1, 0.06, 0.15]} /><meshLambertMaterial color="#A08040" /></mesh>
      {/* bottom boards */}
      <mesh position-y={0.015}><boxGeometry args={[0.8, 0.03, 0.06]} /><meshLambertMaterial color="#B09050" /></mesh>
      <mesh position-y={0.015}><boxGeometry args={[0.8, 0.03, 0.06]} /><meshLambertMaterial color="#B09050" /></mesh>
    </group>
  )
}

/* ── Bauarbeiter (Construction Worker) ────────── */
function Bauarbeiter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.5}>
      {/* body (blue shirt) */}
      <mesh position-y={0.85} castShadow><boxGeometry args={[0.38, 0.5, 0.24]} /><meshLambertMaterial color="#4A6FA5" /></mesh>
      {/* vest (orange) */}
      <mesh position-y={0.90} castShadow><boxGeometry args={[0.42, 0.45, 0.28]} /><meshLambertMaterial color="#FF8C00" /></mesh>
      {/* vest stripes */}
      <mesh position={[0, 0.80, 0.145]}><boxGeometry args={[0.40, 0.04, 0.01]} /><meshBasicMaterial color="#FFB347" /></mesh>
      <mesh position={[0, 1.00, 0.145]}><boxGeometry args={[0.40, 0.04, 0.01]} /><meshBasicMaterial color="#FFB347" /></mesh>
      {/* head */}
      <mesh position-y={1.40} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshLambertMaterial color="#E8C8A0" /></mesh>
      {/* helmet */}
      <mesh position-y={1.52} castShadow><cylinderGeometry args={[0.16, 0.17, 0.06, 8]} /><meshLambertMaterial color="#FFD700" /></mesh>
      <mesh position={[0, 1.50, 0.10]}><boxGeometry args={[0.30, 0.03, 0.12]} /><meshLambertMaterial color="#FFD700" /></mesh>
      {/* eyes */}
      <mesh position={[-0.05, 1.42, 0.12]}><sphereGeometry args={[0.02, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh position={[0.05, 1.42, 0.12]}><sphereGeometry args={[0.02, 6, 4]} /><meshBasicMaterial color="#111" /></mesh>
      {/* legs */}
      <mesh position={[-0.10, 0.25, 0]} castShadow><boxGeometry args={[0.14, 0.50, 0.14]} /><meshLambertMaterial color="#4A5568" /></mesh>
      <mesh position={[0.10, 0.25, 0]} castShadow><boxGeometry args={[0.14, 0.50, 0.14]} /><meshLambertMaterial color="#4A5568" /></mesh>
      {/* arms */}
      <mesh position={[-0.28, 0.85, 0]} castShadow><boxGeometry args={[0.12, 0.50, 0.12]} /><meshLambertMaterial color="#FF8C00" /></mesh>
      <mesh position={[0.28, 0.85, 0]} castShadow><boxGeometry args={[0.12, 0.50, 0.12]} /><meshLambertMaterial color="#FF8C00" /></mesh>
      {/* boots */}
      <mesh position={[-0.10, 0.04, 0.02]}><boxGeometry args={[0.15, 0.08, 0.20]} /><meshLambertMaterial color="#333" /></mesh>
      <mesh position={[0.10, 0.04, 0.02]}><boxGeometry args={[0.15, 0.08, 0.20]} /><meshLambertMaterial color="#333" /></mesh>
    </group>
  )
}

/* ── Low-Poly Tree ────────────────────────────── */
function LowPolyTree({ pos, scale = 1 }: { pos: [number, number, number]; scale?: number }) {
  return (
    <group position={pos} scale={scale}>
      <mesh position-y={0.6} castShadow><cylinderGeometry args={[0.08, 0.12, 1.2, 5]} /><meshLambertMaterial color="#6B4226" /></mesh>
      <mesh position-y={1.5} castShadow><coneGeometry args={[0.6, 1.0, 6]} /><meshLambertMaterial color="#3D7A2A" /></mesh>
      <mesh position-y={2.1} castShadow><coneGeometry args={[0.45, 0.8, 6]} /><meshLambertMaterial color="#4A8C35" /></mesh>
      <mesh position-y={2.5} castShadow><coneGeometry args={[0.28, 0.55, 6]} /><meshLambertMaterial color="#5A9C45" /></mesh>
    </group>
  )
}

/* ── Path Marker ──────────────────────────────── */
function PathMarker({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position-y={0.35} castShadow><boxGeometry args={[0.12, 0.7, 0.12]} /><meshLambertMaterial color="#8A8478" /></mesh>
      <mesh position-y={0.72}><boxGeometry args={[0.2, 0.06, 0.06]} /><meshLambertMaterial color="#9A9488" /></mesh>
    </group>
  )
}

/* ── Wind Particles ───────────────────────────── */
function WindParticles() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const COUNT = 120
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const dataRef = useRef(
    Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 300,
      y: Math.random() * 4 + 0.3,
      z: (Math.random() - 0.5) * 300,
      speed: 0.3 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 0.15,
      size: 0.015 + Math.random() * 0.055,
      phase: Math.random() * Math.PI * 2,
    })),
  )

  useFrame((_, dt) => {
    const data = dataRef.current
    for (let i = 0; i < COUNT; i++) {
      const p = data[i]
      p.x += p.speed * dt
      p.y += Math.sin(p.x * 0.04 + p.phase) * 0.002 + p.drift * dt
      if (p.x > 150) p.x = -150
      if (p.y < 0.2) p.y = 4.5
      if (p.y > 5) p.y = 0.3
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.setScalar(p.size)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFF8E0" transparent opacity={0.3} />
    </instancedMesh>
  )
}

/* ── Cordula's floating Z's ────────────────────── */
function CordulaZParticles() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const COUNT = 8
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const dataRef = useRef(
    Array.from({ length: COUNT }, (_, i) => ({
      offset: i * (Math.PI * 2 / COUNT),
      speed: 0.4 + Math.random() * 0.3,
    })),
  )

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const data = dataRef.current
    for (let i = 0; i < COUNT; i++) {
      const p = data[i]
      const age = ((time * p.speed + p.offset) % 3) / 3
      const x = Math.sin(p.offset * 3) * 0.3
      const y = 1.1 + age * 1.5
      const z = 0.3 + Math.cos(p.offset * 2) * 0.2
      const scale = 0.08 + Math.sin(age * Math.PI) * 0.06
      dummy.position.set(x, y, z)
      dummy.scale.set(scale, scale * 1.4, 0.02)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#88AACC" transparent opacity={0.5} />
    </instancedMesh>
  )
}