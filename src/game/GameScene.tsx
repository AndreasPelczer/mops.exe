'use client'

import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

/* ── Constants ─────────────────────────────────── */
const MOVE_SPEED = 8
const TURN_SPEED = 3
const JUMP_FORCE = 4
const GRAVITY = -18
const RUN_MULT = 1.8   // Shift = rennen
const CAM_HEIGHT = 2.5
const CAM_DIST = 5.5
const INTERACT_DIST = 3.5
const RAFFI_INTERACT_DIST = 5.0

/* ── Positions ─────────────────────────────────── */
const BAUWAGEN_POS   = new THREE.Vector3(0, 0, 0)
const RAFFI_INTERACT = new THREE.Vector3(0, 0, 3)    // front of Bauwagen
const PROF_POS       = new THREE.Vector3(8, 0, 15)   // Guide am Eingang der Hofeinfahrt
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
  /* Sicherheits-Rundgang */
  safetyActive: boolean
  ppeOn: boolean
  hazardsFound: string[]
  onSafetyInteract: (type: string) => void
}

/* ── Sicherheits-Rundgang: Übungsbaustelle beim Bauwagen ── */
const PPE_POS   = new THREE.Vector3(-6, 0, 12)   // PSA-Station
const HAZARDS: { id: string; pos: THREE.Vector3 }[] = [
  { id: 'kante',      pos: new THREE.Vector3(-9, 0, 20) },  // Absturzkante
  { id: 'absperrung', pos: new THREE.Vector3(9, 0, 19) },   // fehlende Absperrung
  { id: 'schutt',     pos: new THREE.Vector3(-4, 0, 26) },  // Stolperfalle
  { id: 'last',       pos: new THREE.Vector3(6, 0, 27) },   // ungesicherte Last
  { id: 'fluchtweg',  pos: new THREE.Vector3(0, 0, 22) },   // blockierter Fluchtweg
]
const HAZARD_DIST = 3.2

/* ── Key state (module-level) ──────────────────── */
const keysDown = new Set<string>()

/* ── Main Scene ────────────────────────────────── */
export default function GameScene({
  questStep, checklist, aufmassWalked,
  onInteract, onRaffiInteract, onProfessorInteract, onCordulaInteract,
  onNearChange, cordulaAwake, chaos,
  safetyActive, ppeOn, hazardsFound, onSafetyInteract,
}: Props) {
  const playerGrp = useRef<THREE.Group>(null!)
  const tailRef   = useRef<THREE.Mesh>(null!)
  const pos       = useRef(new THREE.Vector3(0, 0, 5)) // start in front of Bauwagen
  const yaw       = useRef(0)
  const velY      = useRef(0)
  const grounded  = useRef(true)
  const moveState = useRef<'idle' | 'walk' | 'run' | 'jump'>('idle') // treibt die Animation des Baumops
  const [hofSchritt, setHofSchritt] = useState(0)   // Hofeinfahrt-Bauablauf (0..6), baut sich beim Ablaufen auf
  const hofSchrittRef = useRef(0)
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

        // Sicherheits-Rundgang
        if (safetyActive) {
          if (!ppeOn && p.distanceTo(PPE_POS) < HAZARD_DIST) { onSafetyInteract('ppe'); return }
          for (const h of HAZARDS) {
            if (!hazardsFound.includes(h.id) && p.distanceTo(h.pos) < HAZARD_DIST) { onSafetyInteract(h.id); return }
          }
        }

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
    safetyActive, ppeOn, hazardsFound,
    onInteract, onRaffiInteract, onProfessorInteract, onCordulaInteract, onSafetyInteract])

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
    const running = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')
    const speed = MOVE_SPEED * (running ? RUN_MULT : 1)
    const moving = keysDown.has('KeyW') || keysDown.has('ArrowUp') ||
                   keysDown.has('KeyS') || keysDown.has('ArrowDown')
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp'))   pos.current.addScaledVector(fwd, speed * dt)
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) pos.current.addScaledVector(fwd, -speed * 0.5 * dt)

    /* jump */
    if (keysDown.has('Space') && grounded.current) { velY.current = JUMP_FORCE; grounded.current = false }
    velY.current += GRAVITY * dt
    pos.current.y += velY.current * dt
    if (pos.current.y <= 0) { pos.current.y = 0; velY.current = 0; grounded.current = true }

    /* apply to group */
    playerGrp.current.position.copy(pos.current)
    playerGrp.current.rotation.y = yaw.current
    // Animations-Zustand des Baumops: Sprung > Rennen > Laufen > Winken (Idle)
    moveState.current = !grounded.current ? 'jump'
                      : moving ? (running ? 'run' : 'walk')
                      : 'idle'

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

    // Hofeinfahrt-Fortschritt: die nächste Station in RICHTIGER Reihenfolge ablaufen baut eine Schicht
    if (hofSchrittRef.current < HOF_STATION_POS.length) {
      const ziel = HOF_STATION_POS[hofSchrittRef.current]
      if (p.distanceTo(ziel) < 2.4) {
        hofSchrittRef.current += 1
        setHofSchritt(hofSchrittRef.current)
      }
    }

    let near: string | null = null
    if (safetyActive && !ppeOn && p.distanceTo(PPE_POS) < HAZARD_DIST) near = 'ppe'
    else if (safetyActive && ppeOn && HAZARDS.some(h => !hazardsFound.includes(h.id) && p.distanceTo(h.pos) < HAZARD_DIST)) {
      const h = HAZARDS.find(h => !hazardsFound.includes(h.id) && p.distanceTo(h.pos) < HAZARD_DIST)!
      near = 'hz_' + h.id
    }
    else if (p.distanceTo(RAFFI_INTERACT) < RAFFI_INTERACT_DIST) near = 'raffi'
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
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
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
        {/* Baumops-Modell (gerigt, läuft echt wenn man geht) */}
        <AnimatedMops stateRef={moveState} targetHeight={1.3} />
        {/* PSA: Bauhelm (wenn angelegt) */}
        {ppeOn && <Prop url={`${K}/prototype/hat-hard.glb`} position={[0, 0.6, 0.12]} scale={0.7} />}
      </group>

      {/* ── Bauhütte (Bauleitung) ─────────────── */}
      <Bauhuette />

      {/* ── Sicherheits-Rundgang (Übungsbaustelle) ── */}
      {safetyActive && <SafetyCourse ppeOn={ppeOn} found={hazardsFound} />}

      {/* ── LEVEL 1: Der Bauhof mit der Hofeinfahrt (aufgeräumt, eingezäunt) ── */}
      <Bauhof schritt={hofSchritt} />

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

      {/* ── Pfad zur Baustelle Alpha (die „nächste Baustelle" in der Ferne) ── */}
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

/* ── GLB Kit Loader ────────────────────────────── */
/* Lädt ein GLB, normalisiert die Größe (Quellen sind unterschiedlich
   skaliert) und setzt es sauber auf den Boden. */
function KitModel({
  url, position, targetSize = 2, rotation = 0,
}: {
  url: string
  position: [number, number, number]
  targetSize?: number
  rotation?: number
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.updateMatrixWorld(true)
    // Rohmaße + Mittelpunkt (Sketchfab-Modelle haben oft große interne Transforms)
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    // Inhalt auf Ursprung zentrieren, dann Wrapper auf Zielgröße skalieren
    clone.position.sub(center)
    const wrapper = new THREE.Group()
    wrapper.add(clone)
    wrapper.scale.setScalar(targetSize / maxDim)
    wrapper.updateMatrixWorld(true)
    // sauber auf den Boden absetzen
    const grounded = new THREE.Box3().setFromObject(wrapper)
    wrapper.position.y = -grounded.min.y
    clone.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    return wrapper
  }, [scene, targetSize])
  return (
    <group position={position} rotation-y={rotation}>
      <primitive object={model} />
    </group>
  )
}
useGLTF.preload('/models/construction_tools.glb')
useGLTF.preload('/models/wooden_props.glb')

/* ── KitItem: EIN benanntes Teil aus einem Kit, einzeln platzierbar ──
   Löst z.B. nur die Schaufel aus dem Werkzeug-Kit heraus. Übernimmt den
   Welt-Transform des Quellteils (inkl. Sketchfab-Root-Drehung), zentriert
   auf x/z und setzt auf den Boden. `scale` ist einheitlich pro Kit → echte
   Größenverhältnisse bleiben erhalten. */
function KitItem({
  url, node, position, rotation = 0, scale = 1,
}: {
  url: string
  node: string
  position: [number, number, number]
  rotation?: number
  scale?: number
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    scene.updateMatrixWorld(true)
    const src = scene.getObjectByName(node)
    const wrapper = new THREE.Group()
    if (src) {
      const clone = src.clone(true)
      clone.matrix.copy(src.matrixWorld)
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
      clone.matrixAutoUpdate = true
      wrapper.add(clone)
      wrapper.scale.setScalar(scale)
      wrapper.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(wrapper)
      const center = new THREE.Vector3()
      box.getCenter(center)
      wrapper.position.set(-center.x, -box.min.y, -center.z)
      wrapper.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    }
    return wrapper
  }, [scene, node, scale])
  return (
    <group position={position} rotation-y={rotation}>
      <primitive object={model} />
    </group>
  )
}

/* ── CharModel: gerigte Charaktere (Mensch/Tier) ──
   Nutzt drei <Clone> (klont Skelette korrekt, anders als scene.clone()).
   Normalisiert auf targetSize (Höhe), zentriert x/z, setzt auf den Boden. */
function CharModel({
  url, position, rotation = 0, scale = 1,
}: {
  url: string
  position: [number, number, number]
  rotation?: number
  scale?: number
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    // SkeletonUtils.clone klont Skelett + Bindung korrekt (drei <Clone>/scene.clone nicht)
    const c = SkeletonUtils.clone(scene)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true }
    })
    return c
  }, [scene])
  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}

/* ── AnimatedMops: der gerigte Baumops mit Bewegungssatz ──
   Ein Modell (Walk-Mesh), drei Clips aus drei GLBs mit demselben Rig:
   walk · run · jump. Idle = auf dem Walk-Clip eingefroren → steht ruhig (kein Winken).
   Blendet weich zwischen den Zuständen (crossFade).
   Normalisiert auf targetHeight (Höhe) und setzt sauber auf den Boden. */
const MOPS_WALK = '/models/chars/baumops_walk.glb'
const MOPS_RUN  = '/models/chars/baumops_run.glb'
const MOPS_JUMP = '/models/chars/baumops_jump.glb'
const CLIP_FOR = {
  idle: 'Armature|walking_man|baselayer',   // eingefroren = steht ruhig
  walk: 'Armature|walking_man|baselayer',
  run:  'Armature|running|baselayer',
  jump: 'Armature|Jump_Run|baselayer',
} as const
type MoveState = keyof typeof CLIP_FOR

function AnimatedMops({
  stateRef, targetHeight = 1.4, rotation = 0,
}: {
  stateRef: { current: MoveState }
  targetHeight?: number
  rotation?: number
}) {
  const group = useRef<THREE.Group>(null!)
  const walk = useGLTF(MOPS_WALK)
  const run  = useGLTF(MOPS_RUN)
  const jump = useGLTF(MOPS_JUMP)
  // alle Clips auf dasselbe Rig (Bone-Namen identisch) → auf dem Walk-Mesh abspielbar
  const clips = useMemo(
    () => [...walk.animations, ...run.animations, ...jump.animations],
    [walk.animations, run.animations, jump.animations],
  )
  const { actions } = useAnimations(clips, group)
  const current = useRef<MoveState | null>(null)

  const norm = useMemo(() => {
    walk.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true }
    })
    const box = new THREE.Box3().setFromObject(walk.scene)
    const size = new THREE.Vector3(); box.getSize(size)
    const s = size.y > 0 ? targetHeight / size.y : 1
    return { scale: s, minY: box.min.y * s }
  }, [walk.scene, targetHeight])

  useFrame(() => {
    const want = stateRef.current
    if (want === current.current) return            // nur bei Zustandswechsel wechseln
    const next = actions[CLIP_FOR[want]]
    const prev = current.current ? actions[CLIP_FOR[current.current]] : undefined
    if (next) {
      next.reset().setEffectiveWeight(1).play()
      next.paused = want === 'idle'                  // Idle = eingefroren → steht ruhig
      if (prev && prev !== next) prev.crossFadeTo(next, 0.18, false)
    }
    current.current = want
  })

  return (
    <group ref={group} rotation-y={rotation} scale={norm.scale} position={[0, -norm.minY, 0]}>
      <primitive object={walk.scene} />
    </group>
  )
}
useGLTF.preload(MOPS_WALK)
useGLTF.preload(MOPS_RUN)
useGLTF.preload(MOPS_JUMP)

/* ── Prop: Einzelmodell in nativer Skala (Kenney etc.) ── */
/* Kenney-Kits sind schon in Metern modelliert (Wand 2.4m, Boden 2×2m),
   daher hier KEINE Auto-Normalisierung – nur optionaler scale-Faktor. */
function Prop({
  url, position, rotation = 0, scale = 1,
}: {
  url: string
  position: [number, number, number]
  rotation?: number
  scale?: number
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    return clone
  }, [scene])
  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

/* Kenney-Bauteile + Schutt vorladen */
const K = '/models/kenney'
useGLTF.preload(`${K}/building/floor.glb`)
useGLTF.preload(`${K}/building/wall.glb`)
useGLTF.preload(`${K}/building/wall-doorway-square.glb`)
useGLTF.preload(`${K}/building/wall-window-square.glb`)
useGLTF.preload(`${K}/building/column.glb`)
useGLTF.preload(`${K}/prototype/crate.glb`)
useGLTF.preload(`${K}/prototype/ladder.glb`)
useGLTF.preload(`${K}/prototype/hat-hard.glb`)
useGLTF.preload('/models/debris_kit.glb')
useGLTF.preload('/models/baustelle_wall.glb')
useGLTF.preload('/models/baustelle_rubble.glb')
useGLTF.preload('/models/tool_haven.glb')
useGLTF.preload('/models/tow_tractor.glb')
useGLTF.preload('/models/construction_tools.glb')
useGLTF.preload('/models/wooden_props.glb')
for (let n = 1; n <= 6; n++) useGLTF.preload(`/models/kenney/prototype/number-${n}.glb`)
useGLTF.preload('/models/chars/pug.glb')
useGLTF.preload('/models/chars/worker1.glb')
useGLTF.preload('/models/chars/worker2.glb')

/* ── Rohbau (halbfertiges Gebäude aus Kenney-Bauteilen) ── */
/* Kenney-Grid: Bodenplatte 2×2 m, Wand 2 m breit / 2.4 m hoch.
   rotation 0 = Wand läuft entlang Z; π/2 = Wand läuft entlang X. */
function Rohbau({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const R = Math.PI / 2
  return (
    <group position={position} rotation-y={rotation}>
      {/* Bodenplatte 3×2 Kacheln (6×4 m) */}
      {[-2, 0, 2].map((x) =>
        [-2, 0].map((z) => <Prop key={`f${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 0, z]} />),
      )}

      {/* Westwand (voll) */}
      <Prop url={`${K}/building/wall.glb`} position={[-3, 0, -2]} />
      <Prop url={`${K}/building/wall.glb`} position={[-3, 0, 0]} />
      {/* Ostwand (mit Fenstern) */}
      <Prop url={`${K}/building/wall-window-square.glb`} position={[3, 0, -2]} />
      <Prop url={`${K}/building/wall-window-square.glb`} position={[3, 0, 0]} />
      {/* Südwand mit Türöffnung */}
      <Prop url={`${K}/building/wall.glb`} position={[-2, 0, -3]} rotation={R} />
      <Prop url={`${K}/building/wall-doorway-square.glb`} position={[0, 0, -3]} rotation={R} />
      {/* Nordseite: im Bau – nur eine Wand, Rest offen */}
      <Prop url={`${K}/building/wall.glb`} position={[-2, 0, 1]} rotation={R} />

      {/* Eckstützen */}
      <Prop url={`${K}/building/column.glb`} position={[3, 0, 1]} />
      <Prop url={`${K}/building/column.glb`} position={[3, 0, -3]} />

      {/* Baustelleninventar */}
      <Prop url={`${K}/prototype/ladder.glb`} position={[2.6, 0, 0.4]} rotation={-0.3} />
      <Prop url={`${K}/prototype/crate.glb`} position={[-1.6, 0, -0.6]} rotation={0.4} />
      <Prop url={`${K}/prototype/crate.glb`} position={[-1.2, 0, -1.1]} rotation={-0.2} />
      <Prop url={`${K}/prototype/crate.glb`} position={[-1.5, 0.5, -0.9]} rotation={0.1} />

      {/* Schutthaufen (komprimierter debris_kit) */}
      <KitModel url="/models/debris_kit.glb" position={[1, 0, -0.5]} targetSize={3.6} rotation={0.6} />
    </group>
  )
}

/* ── Probe-Bauplatz (Muster für die Szenen-Überarbeitung) ──
   Alles aus Kit-Teilen: Bauhütte, Rohbau, einzeln gesetzte Werkzeuge,
   Müll & Holz in passender Größe. */
const T_URL = '/models/construction_tools.glb'
function BaustellePoC({ position }: { position: [number, number, number] }) {
  const R = Math.PI / 2
  return (
    <group position={position}>
      {/* Sandplatz */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshLambertMaterial color="#C4A870" />
      </mesh>

      {/* ── Bauhütte / Büro (2×2, 4×4 m) ── */}
      <group position={[-5, 0, -3]}>
        {[-1, 1].map((x) => [-1, 1].map((z) => <Prop key={`bf${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 0, z]} />))}
        {/* West / Ost */}
        <Prop url={`${K}/building/wall.glb`} position={[-2, 0, -1]} />
        <Prop url={`${K}/building/wall.glb`} position={[-2, 0, 1]} />
        <Prop url={`${K}/building/wall-window-square.glb`} position={[2, 0, -1]} />
        <Prop url={`${K}/building/wall.glb`} position={[2, 0, 1]} />
        {/* Nord */}
        <Prop url={`${K}/building/wall.glb`} position={[-1, 0, -2]} rotation={R} />
        <Prop url={`${K}/building/wall.glb`} position={[1, 0, -2]} rotation={R} />
        {/* Süd (Front): Tür + Fenster */}
        <Prop url={`${K}/building/wall-doorway-square.glb`} position={[-1, 0, 2]} rotation={R} />
        <Prop url={`${K}/building/wall-window-square.glb`} position={[1, 0, 2]} rotation={R} />
        {/* Flachdach */}
        {[-1, 1].map((x) => [-1, 1].map((z) => <Prop key={`br${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 2.4, z]} />))}
      </group>

      {/* ── Rohbau nebenan ── */}
      <group position={[5, 0, -3]}>
        {[-1, 1].map((x) => [-1, 1].map((z) => <Prop key={`gf${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 0, z]} />))}
        <Prop url={`${K}/building/wall.glb`} position={[-2, 0, -1]} />
        <Prop url={`${K}/building/wall-window-square.glb`} position={[-2, 0, 1]} />
        <Prop url={`${K}/building/wall.glb`} position={[-1, 0, -2]} rotation={R} />
        <Prop url={`${K}/building/column.glb`} position={[2, 0, 2]} />
        <Prop url={`${K}/building/column.glb`} position={[2, 0, -2]} />
      </group>

      {/* ── Werkzeuge EINZELN aus dem Kit gesetzt ── */}
      <KitItem url={T_URL} node="WheelBarrow-01_0" position={[0, 0, 3.5]} rotation={0.6} scale={1.7} />
      <KitItem url={T_URL} node="Shovel_16" position={[1.4, 0, 2.8]} rotation={-0.4} scale={1.7} />
      <KitItem url={T_URL} node="bucket-01_12" position={[-0.9, 0, 2.6]} scale={1.7} />
      <KitItem url={T_URL} node="bucket-02_11" position={[-1.5, 0, 3.1]} rotation={0.5} scale={1.7} />
      <KitItem url={T_URL} node="Sign-01_10" position={[7, 0, 4]} rotation={-0.5} scale={1.7} />
      <KitItem url={T_URL} node="Road Closed-01_7" position={[-6, 0, 5]} rotation={0.2} scale={1.7} />
      <KitItem url={T_URL} node="Road Closed-02_8" position={[-4, 0, 5.4]} rotation={0.1} scale={1.7} />

      {/* ── Müll & Holz in passender Größe ── */}
      <KitModel url="/models/debris_kit.glb" position={[3.5, 0, 4]} targetSize={2.2} rotation={0.6} />
      <KitModel url="/models/wooden_props.glb" position={[-3, 0, -5]} targetSize={2.8} rotation={0.3} />
    </group>
  )
}

/* ── Warnmarker über einer Gefahr (⚠ / ✓) ────── */
function HazardMarker({ position, found }: { position: THREE.Vector3; found: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 2.4 + Math.sin(clock.getElapsedTime() * 2.5) * 0.15
      ref.current.rotation.y = clock.getElapsedTime() * 1.2
    }
  })
  const color = found ? '#4CAF50' : '#FF3B30'
  return (
    <group position={[position.x, 0, position.z]}>
      <group ref={ref} position-y={2.4}>
        {/* Diamant */}
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <octahedronGeometry args={[0.32, 0]} />
          <meshBasicMaterial color={color} transparent opacity={found ? 0.5 : 0.9} />
        </mesh>
        {/* Ausrufezeichen-Balken (nur ungelöst) */}
        {!found && (
          <>
            <mesh position={[0, 0.02, 0.34]}><boxGeometry args={[0.05, 0.16, 0.02]} /><meshBasicMaterial color="#fff" /></mesh>
            <mesh position={[0, -0.13, 0.34]}><boxGeometry args={[0.05, 0.05, 0.02]} /><meshBasicMaterial color="#fff" /></mesh>
          </>
        )}
      </group>
      <pointLight position-y={2.4} color={color} intensity={found ? 0.3 : 0.7} distance={5} />
      {/* Bodenring */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[0.5, 0.62, 20]} />
        <meshBasicMaterial color={color} transparent opacity={found ? 0.15 : 0.35} />
      </mesh>
    </group>
  )
}

/* ── Sicherheits-Rundgang: Übungsbaustelle ─────── */
function SafetyCourse({ ppeOn, found }: { ppeOn: boolean; found: string[] }) {
  return (
    <>
      {/* Übungs-Fläche (Sand) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 20]} receiveShadow>
        <planeGeometry args={[30, 26]} />
        <meshLambertMaterial color="#C4A870" />
      </mesh>

      {/* ── PSA-Station ───────────────────────── */}
      <group position={[PPE_POS.x, 0, PPE_POS.z]}>
        {/* Ständer */}
        <mesh position-y={0.75} castShadow><cylinderGeometry args={[0.06, 0.06, 1.5, 8]} /><meshLambertMaterial color="#8A8478" /></mesh>
        <mesh position-y={0.02}><cylinderGeometry args={[0.35, 0.35, 0.05, 12]} /><meshLambertMaterial color="#6B6B6B" /></mesh>
        {/* Tafel */}
        <mesh position={[0, 1.7, 0]}><boxGeometry args={[1.1, 0.7, 0.05]} /><meshLambertMaterial color="#1565C0" /></mesh>
        <mesh position={[0, 1.7, 0.03]}><boxGeometry args={[0.95, 0.55, 0.02]} /><meshBasicMaterial color="#1E88E5" /></mesh>
        {/* Helm auf dem Ständer (nur solange nicht angelegt) */}
        {!ppeOn && <Prop url={`${K}/prototype/hat-hard.glb`} position={[0, 1.52, 0]} scale={1.1} />}
        {!ppeOn && (
          <>
            <pointLight position-y={1.6} color="#42A5F5" intensity={0.6} distance={5} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
              <ringGeometry args={[0.5, 0.62, 20]} />
              <meshBasicMaterial color="#42A5F5" transparent opacity={0.4} />
            </mesh>
          </>
        )}
      </group>

      {/* ── Gefahr 1: Absturzkante (erhöhte Plattform ohne Geländer) ── */}
      <group position={[HAZARDS[0].pos.x, 0, HAZARDS[0].pos.z]}>
        {[-1, 1].map((sx) => [-1, 1].map((sz) => (
          <mesh key={`c${sx}${sz}`} position={[sx * 0.9, 0.6, sz * 0.9]} castShadow>
            <boxGeometry args={[0.16, 1.2, 0.16]} /><meshLambertMaterial color="#9E8B5E" />
          </mesh>
        )))}
        <Prop url={`${K}/building/floor.glb`} position={[-1, 1.2, 0]} />
        <Prop url={`${K}/building/floor.glb`} position={[1, 1.2, 0]} />
      </group>
      <HazardMarker position={HAZARDS[0].pos} found={found.includes('kante')} />

      {/* ── Gefahr 2: fehlende Absperrung an einer Grube ── */}
      <group position={[HAZARDS[1].pos.x, 0, HAZARDS[1].pos.z]}>
        {/* Grube */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}><planeGeometry args={[2.4, 2.4]} /><meshBasicMaterial color="#1a1206" /></mesh>
        <mesh position-y={-0.4}><boxGeometry args={[2.2, 0.8, 2.2]} /><meshLambertMaterial color="#3a2c14" /></mesh>
        {/* Aushub daneben */}
        <mesh position={[1.6, 0.2, 0]}><coneGeometry args={[0.6, 0.5, 8]} /><meshLambertMaterial color="#8a6d3a" /></mesh>
      </group>
      <HazardMarker position={HAZARDS[1].pos} found={found.includes('absperrung')} />

      {/* ── Gefahr 3: Stolperfalle (Schutt im Laufweg) ── */}
      <KitModel url="/models/debris_kit.glb" position={[HAZARDS[2].pos.x, 0, HAZARDS[2].pos.z]} targetSize={3} rotation={1.1} />
      <HazardMarker position={HAZARDS[2].pos} found={found.includes('schutt')} />

      {/* ── Gefahr 4: ungesicherte Last (wackelig gestapelte Kisten) ── */}
      <group position={[HAZARDS[3].pos.x, 0, HAZARDS[3].pos.z]}>
        <Prop url={`${K}/prototype/crate.glb`} position={[0, 0, 0]} />
        <Prop url={`${K}/prototype/crate.glb`} position={[0.05, 0.5, 0.05]} rotation={0.15} />
        <Prop url={`${K}/prototype/crate.glb`} position={[-0.1, 1.0, -0.05]} rotation={0.45} />
      </group>
      <HazardMarker position={HAZARDS[3].pos} found={found.includes('last')} />

      {/* ── Gefahr 5: blockierter Fluchtweg (verstellte Tür) ── */}
      <group position={[HAZARDS[4].pos.x, 0, HAZARDS[4].pos.z]}>
        <Prop url={`${K}/building/wall-doorway-square.glb`} position={[0, 0, 0]} rotation={Math.PI / 2} />
        {/* Kisten vor der Tür */}
        <Prop url={`${K}/prototype/crate.glb`} position={[0, 0, 0.2]} />
        <Prop url={`${K}/prototype/crate.glb`} position={[0.4, 0, 0.2]} rotation={0.2} />
      </group>
      <HazardMarker position={HAZARDS[4].pos} found={found.includes('fluchtweg')} />
    </>
  )
}

/* ── Bauwagen (Construction Trailer) ─────────── */
/* ── Bauhütte (Büro/Bauleitung, aus Kit-Teilen) ── */
function Bauhuette() {
  const R = Math.PI / 2
  return (
    <group position={[BAUWAGEN_POS.x, 0, BAUWAGEN_POS.z]}>
      {/* Boden 3×2 (6×4 m) */}
      {[-2, 0, 2].map((x) => [-1, 1].map((z) => <Prop key={`f${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 0, z]} />))}
      {/* Rückwand (z=-2) */}
      {[-2, 0, 2].map((x) => <Prop key={`bw${x}`} url={`${K}/building/wall.glb`} position={[x, 0, -2]} rotation={R} />)}
      {/* Links (x=-3) */}
      <Prop url={`${K}/building/wall.glb`} position={[-3, 0, -1]} />
      <Prop url={`${K}/building/wall-window-square.glb`} position={[-3, 0, 1]} />
      {/* Rechts (x=3) */}
      <Prop url={`${K}/building/wall-window-square.glb`} position={[3, 0, -1]} />
      <Prop url={`${K}/building/wall.glb`} position={[3, 0, 1]} />
      {/* Front (z=2): Tür in der Mitte */}
      <Prop url={`${K}/building/wall-window-square.glb`} position={[-2, 0, 2]} rotation={R} />
      <Prop url={`${K}/building/wall-doorway-square.glb`} position={[0, 0, 2]} rotation={R} />
      <Prop url={`${K}/building/wall.glb`} position={[2, 0, 2]} rotation={R} />
      {/* Flachdach */}
      {[-2, 0, 2].map((x) => [-1, 1].map((z) => <Prop key={`r${x}_${z}`} url={`${K}/building/floor.glb`} position={[x, 2.4, z]} />))}

      {/* Theke */}
      <mesh position={[0, 0.5, -1]} castShadow><boxGeometry args={[2.5, 0.8, 0.5]} /><meshLambertMaterial color="#8B6914" /></mesh>
      <mesh position={[0, 0.92, -1]}><boxGeometry args={[2.6, 0.04, 0.55]} /><meshLambertMaterial color="#A07828" /></mesh>
      <mesh position={[-0.4, 0.96, -0.9]} rotation-y={0.2}><boxGeometry args={[0.25, 0.01, 0.18]} /><meshLambertMaterial color="#F5F0E0" /></mesh>

      {/* Raffi (Charakter-Modell) */}
      <CharModel url="/models/chars/worker1.glb" position={[0, 0, -1.5]} scale={0.04} rotation={0} />

      {/* Baustellenschild aus dem Kit */}
      <KitItem url={T_URL} node="Sign-01_10" position={[4, 0, 3]} rotation={-0.6} scale={1.8} />
      {/* Innenlicht */}
      <pointLight position={[0, 2.2, -0.6]} color="#FFE4B5" intensity={0.7} distance={6} />
    </group>
  )
}

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
  return <CharModel url="/models/chars/worker2.glb" position={position} scale={0.04} rotation={-0.3} />
}

/* ── Baustelle Alpha ──────────────────────────── */
/* ── Hofeinfahrt: das erste Level aus Raphis DXF (Testhofeinfahrt.dxf) ──
   ~10×10 m gepflasterte Fläche mit Leistenstein-Einfassung, davor die
   Arbeitsschritte aus dem iMOPS-DemoSeeder (DEMO-BAU-001) als Bauablauf-Tafel.
   Maßstab: 1 Spiel-Einheit ≈ 1 m (Mops ~1,3 m hoch). Liegt vor dem Spawn (W = hin). */
const HOFEINFAHRT_CENTER = new THREE.Vector3(0, 0, 26)
// Auslöse-Punkte der 6 Bauablauf-Stationen: auf dem Laufweg (Einfahrt-Mitte, leicht links),
// damit Geradeauslaufen die Schritte 1→6 der Reihe nach auslöst. Die Schilder stehen seitlich.
const HOF_STATION_POS = [0, 1, 2, 3, 4, 5].map(
  (i) => new THREE.Vector3(HOFEINFAHRT_CENTER.x - 1.5, 0, HOFEINFAHRT_CENTER.z - 3.4 + i * 1.6),
)

// Bauablauf — 1:1 aus DemoSeeder.hofeinfahrtMaterialCodes, in Einbau-Reihenfolge
const BAUABLAUF_SCHRITTE = [
  '1  Trennvlies auslegen              (VLI-GEO)',
  '2  Schotter 0/32 + verdichten       (SCH-032) DIN 18315',
  '3  Randsteine in Beton setzen       (RND-TB + BET-C16) DIN 18318',
  '4  Splittbettung 2/8 abziehen       (SPL-208)',
  '5  Verbundpflaster verlegen         (PFL-VBS) DIN 18318',
  '6  Fugensand einkehren + abruetteln (FUG-02)',
]

function makePflasterTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#63636a'; g.fillRect(0, 0, 256, 256)          // Fugen (dunkel)
  const bw = 58, bh = 26, gap = 4
  let row = 0
  for (let y = -bh; y < 256; y += bh + gap) {
    const off = (row % 2) * (bw / 2)
    for (let x = -bw; x < 256 + bw; x += bw + gap) {
      const s = 150 + Math.floor(Math.random() * 28)
      g.fillStyle = `rgb(${s},${s},${s - 8})`
      g.fillRect(x + off, y, bw, bh)
    }
    row++
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 5)
  return tex
}

function makeTafelTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 700
  const g = c.getContext('2d')!
  g.fillStyle = '#1c1c22'; g.fillRect(0, 0, 1024, 700)
  g.fillStyle = '#E8842A'; g.fillRect(0, 0, 1024, 92)
  g.fillStyle = '#111'; g.font = 'bold 50px sans-serif'
  g.fillText('HOFEINFAHRT · BAUABLAUF', 30, 62)
  g.fillStyle = '#35C759'; g.font = 'bold 28px sans-serif'
  g.fillText('Ziel: Stationen 1 → 6 der Reihe nach ablaufen — die Einfahrt baut sich auf.', 32, 138)
  g.fillStyle = '#F2E9D8'; g.font = '30px sans-serif'
  BAUABLAUF_SCHRITTE.forEach((s, i) => g.fillText(s, 32, 210 + i * 68))
  g.fillStyle = '#8aa0b0'; g.font = 'italic 22px sans-serif'
  g.fillText('Quelle: iMOPS DemoSeeder · DEMO-BAU-001', 32, 210 + 6 * 68 + 6)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

// Lieferschein — Materialien 1:1 aus DemoSeeder (hofeinfahrtMaterialCodes), Menge = Richtwert aus 100 m²
const LIEFER_POSITIONEN = [
  ['Trennvlies Geotextil (VLI-GEO)', '~110 m2'],
  ['Schotter 0/32       (SCH-032)', '~30 m3'],
  ['Pflastersplitt 2/8  (SPL-208)', '~4 m3'],
  ['Verbundpflaster     (PFL-VBS)', '~100 m2'],
  ['Randstein Tiefbord  (RND-TB)', '~40 m'],
  ['Beton C16/20        (BET-C16)', '~2 m3'],
  ['Fugensand 0/2       (FUG-02)', '~1 m3'],
]

function makeLieferscheinTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 900; c.height = 640
  const g = c.getContext('2d')!
  g.fillStyle = '#F5F1E6'; g.fillRect(0, 0, 900, 640)        // Papier
  g.fillStyle = '#2C6E49'; g.fillRect(0, 0, 900, 84)         // grüner Kopf
  g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'
  g.fillText('LIEFERSCHEIN', 28, 58)
  g.fillStyle = '#333'; g.font = '24px sans-serif'
  g.fillText('Hofeinfahrt · BV DEMO-BAU-001 · geliefert ✓', 28, 128)
  g.strokeStyle = '#c9c2ad'; g.beginPath(); g.moveTo(28, 148); g.lineTo(872, 148); g.stroke()
  g.font = '26px monospace'
  LIEFER_POSITIONEN.forEach(([name, menge], i) => {
    const y = 196 + i * 58
    g.fillStyle = '#1c1c1c'; g.fillText(name, 30, y)
    g.fillStyle = '#2C6E49'; g.fillText(menge, 690, y)
    g.fillStyle = '#2C6E49'; g.fillText('✓', 852, y)
  })
  g.fillStyle = '#8a8577'; g.font = 'italic 20px sans-serif'
  g.fillText('Menge = Richtwert aus 100 m² · Quelle iMOPS DemoSeeder', 30, 616)
  return new THREE.CanvasTexture(c)
}

/* ── Beschriftung als Canvas-Textur (Schilder, Stationen) ──
   Wird NUR im Client (useMemo) erzeugt — document gibt es beim SSR-Prerender nicht. */
function makeSchildTexture(header: string, titel: string, unter: string, norm: string): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 300
  const g = c.getContext('2d')!
  g.fillStyle = '#F5EFDF'; g.fillRect(0, 0, 512, 300)
  g.fillStyle = '#E8842A'; g.fillRect(0, 0, 512, 74)
  g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText(header, 20, 52)
  g.fillStyle = '#1c1c1c'; g.font = 'bold 42px sans-serif'; g.fillText(titel, 20, 146)
  if (unter) { g.fillStyle = '#2C6E49'; g.font = '30px monospace'; g.fillText(unter, 20, 204) }
  if (norm) { g.fillStyle = '#6b6b6b'; g.font = 'italic 26px sans-serif'; g.fillText(norm, 20, 250) }
  g.strokeStyle = '#c9b98a'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 294)
  return new THREE.CanvasTexture(c)
}

// Wire-Mesh-Textur für den Bauzaun (transparent, gekachelt)
function makeZaunTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(205,205,210,0.85)'; g.lineWidth = 2
  for (let i = -128; i < 128; i += 15) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke()
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t
}

// Ein Bauzaun-Element (Füße + Pfosten + Gitter) — billig aus Primitiven, beliebig kachelbar
function ZaunPanel({ position, rotation = 0, tex, w = 3.4, h = 2.0 }: {
  position: [number, number, number]; rotation?: number; tex: THREE.Texture; w?: number; h?: number
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[-w / 2 + 0.1, 0.08, 0]} castShadow><boxGeometry args={[0.5, 0.16, 0.28]} /><meshLambertMaterial color="#c25a2a" /></mesh>
      <mesh position={[w / 2 - 0.1, 0.08, 0]} castShadow><boxGeometry args={[0.5, 0.16, 0.28]} /><meshLambertMaterial color="#c25a2a" /></mesh>
      <mesh position={[-w / 2 + 0.1, h / 2, 0]}><cylinderGeometry args={[0.035, 0.035, h, 6]} /><meshLambertMaterial color="#cfcfcf" /></mesh>
      <mesh position={[w / 2 - 0.1, h / 2, 0]}><cylinderGeometry args={[0.035, 0.035, h, 6]} /><meshLambertMaterial color="#cfcfcf" /></mesh>
      <mesh position={[0, h - 0.12, 0]}><boxGeometry args={[w - 0.2, 0.05, 0.05]} /><meshLambertMaterial color="#cfcfcf" /></mesh>
      <mesh position={[0, 0.28, 0]}><boxGeometry args={[w - 0.2, 0.05, 0.05]} /><meshLambertMaterial color="#cfcfcf" /></mesh>
      <mesh position={[0, h / 2 + 0.05, 0]}>
        <planeGeometry args={[w - 0.25, h - 0.45]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.1} opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
function ZaunReihe({ start, count, dir, step = 3.4, tex }: {
  start: [number, number]; count: number; dir: 'x' | 'z'; step?: number; tex: THREE.Texture
}) {
  return <>{Array.from({ length: count }).map((_, i) => (
    <ZaunPanel key={i} tex={tex}
      position={dir === 'x' ? [start[0] + i * step, 0, start[1]] : [start[0], 0, start[1] + i * step]}
      rotation={dir === 'x' ? 0 : Math.PI / 2} />
  ))}</>
}

// Die 6 Bauablauf-Schritte (aus DemoSeeder) als Stationen entlang der Einfahrt
const BAUABLAUF_STATIONEN = [
  { nr: 1, titel: 'Trennvlies', material: 'VLI-GEO', norm: '', farbe: '#5c6b4f' },
  { nr: 2, titel: 'Schotter 0/32', material: 'SCH-032', norm: 'DIN 18315', farbe: '#8a8a86' },
  { nr: 3, titel: 'Randsteine', material: 'RND-TB+C16', norm: 'DIN 18318', farbe: '#b9b3a7' },
  { nr: 4, titel: 'Splittbettung', material: 'SPL-208', norm: '', farbe: '#c9c6bd' },
  { nr: 5, titel: 'Pflaster', material: 'PFL-VBS', norm: 'DIN 18318', farbe: '#6f6f73' },
  { nr: 6, titel: 'Fugen', material: 'FUG-02', norm: '', farbe: '#cbb58a' },
]
type Station = typeof BAUABLAUF_STATIONEN[number]

function BauablaufStation({ station, position, done = false }: { station: Station; position: [number, number, number]; done?: boolean }) {
  const tex = useMemo(() => makeSchildTexture(`Schritt ${station.nr}`, station.titel, station.material, station.norm), [station])
  return (
    <group position={position} rotation-y={Math.PI / 2}>
      {/* Materialhaufen als Muster (Farbe = Schicht) */}
      <mesh position={[0, 0.18, 0.9]} castShadow><boxGeometry args={[0.9, 0.36, 0.7]} /><meshLambertMaterial color={station.farbe} /></mesh>
      {/* 3D-Nummer aus dem Kenney-Kit */}
      <KitModel url={`${K}/prototype/number-${station.nr}.glb`} position={[0, 0, -0.9]} targetSize={1.1} />
      {/* Schild auf Pfosten */}
      <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.04, 0.04, 1.5, 8]} /><meshLambertMaterial color="#777" /></mesh>
      <mesh position={[0, 1.5, 0.03]}><planeGeometry args={[1.5, 0.88]} /><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      {/* erledigt: grüne Kugel als Haken über dem Schild */}
      {done && (
        <mesh position={[0.62, 1.95, 0.05]}>
          <sphereGeometry args={[0.16, 12, 10]} /><meshBasicMaterial color="#35C759" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// Materiallager / Fundus: die Sets ordentlich auf einem Kies-Pad, RICHTIG skaliert
function Materiallager({ position }: { position: [number, number, number] }) {
  const schild = useMemo(() => makeSchildTexture('Bauhof', 'Materiallager', 'Fundus', ''), [])
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow><planeGeometry args={[14, 12]} /><meshLambertMaterial color="#a89a7c" /></mesh>
      <KitModel url="/models/tool_haven.glb"        position={[3.5, 0, -3]} targetSize={5}   rotation={-0.4} />
      <KitModel url="/models/construction_tools.glb" position={[-3, 0, -2]} targetSize={2.4} rotation={0.3} />
      <KitModel url="/models/wooden_props.glb"       position={[-4, 0, 2]}  targetSize={2.4} rotation={-0.2} />
      <KitModel url="/models/debris_kit.glb"         position={[0, 0, 3]}   targetSize={2.4} rotation={0.5} />
      <KitModel url="/models/baustelle_rubble.glb"   position={[5, 0, 3.5]} targetSize={5}   rotation={-1.0} />
      <Baupalette position={[-1.5, 0, -3.5]} />
      <mesh position={[-1.5, 0.22, -3.5]} castShadow><boxGeometry args={[0.9, 0.4, 0.7]} /><meshLambertMaterial color="#8a8a86" /></mesh>
      <Baupalette position={[-0.3, 0, -3.3]} rotation={0.2} />
      <mesh position={[-0.3, 0.2, -3.3]} castShadow><boxGeometry args={[0.85, 0.36, 0.65]} /><meshLambertMaterial color="#c9c6bd" /></mesh>
      <mesh position={[-6, 0.9, -5]}><cylinderGeometry args={[0.05, 0.05, 1.8, 8]} /><meshLambertMaterial color="#777" /></mesh>
      <mesh position={[-6, 1.7, -4.97]}><planeGeometry args={[2.2, 1.3]} /><meshBasicMaterial map={schild} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

// Tor mit Baustellenschild (zeigt zum ankommenden Spieler)
function Tor({ position }: { position: [number, number, number] }) {
  const schild = useMemo(() => makeSchildTexture('Baustelle', 'Hofeinfahrt', 'DEMO-BAU-001', ''), [])
  return (
    <group position={position}>
      <mesh position={[-3, 1.3, 0]} castShadow><boxGeometry args={[0.3, 2.6, 0.3]} /><meshLambertMaterial color="#c25a2a" /></mesh>
      <mesh position={[3, 1.3, 0]} castShadow><boxGeometry args={[0.3, 2.6, 0.3]} /><meshLambertMaterial color="#c25a2a" /></mesh>
      <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[6.3, 0.3, 0.3]} /><meshLambertMaterial color="#c25a2a" /></mesh>
      {/* Schild seitlich am linken Pfosten, Front zeigt nach −z (zum Spieler) */}
      <group position={[-3, 1.55, -0.25]} rotation-y={Math.PI}>
        <mesh><planeGeometry args={[2.4, 1.45]} /><meshBasicMaterial map={schild} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  )
}

// LEVEL 1: der ganze Bauhof — Kies-Boden, das Level (Hofeinfahrt), Fundus, Umzäunung mit Tor
function Bauhof({ schritt }: { schritt: number }) {
  const zaunTex = useMemo(makeZaunTexture, [])
  return (
    <group>
      {/* Kies-Boden des Bauhofs (hebt den Platz vom Grün ab) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 24]} receiveShadow>
        <planeGeometry args={[42, 34]} /><meshLambertMaterial color="#9d9074" />
      </mesh>
      {/* das eigentliche Level */}
      <Hofeinfahrt schritt={schritt} />
      {/* Fundus rechts */}
      <Materiallager position={[13, 0, 15]} />
      {/* Umzäunung: Tor vorne (Einfahrt), Zaun ringsum */}
      <Tor position={[0, 0, 8]} />
      <ZaunReihe tex={zaunTex} start={[-19, 8]}  count={5}  dir="x" />
      <ZaunReihe tex={zaunTex} start={[4, 8]}    count={5}  dir="x" />
      <ZaunReihe tex={zaunTex} start={[-19, 40]} count={12} dir="x" />
      <ZaunReihe tex={zaunTex} start={[-20, 10]} count={9}  dir="z" />
      <ZaunReihe tex={zaunTex} start={[20, 10]}  count={9}  dir="z" />
    </group>
  )
}

function Hofeinfahrt({ schritt }: { schritt: number }) {
  const pflaster = useMemo(makePflasterTexture, [])
  const tafel = useMemo(makeTafelTexture, [])
  const lieferschein = useMemo(makeLieferscheinTexture, [])
  const S = 10, half = S / 2, b = 0.25
  return (
    <group position={[HOFEINFAHRT_CENTER.x, 0, HOFEINFAHRT_CENTER.z]}>
      {/* Planum (Sand) — Ausgangszustand, immer da */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
        <planeGeometry args={[S + 1.4, S + 1.4]} /><meshLambertMaterial color="#b9a06a" />
      </mesh>
      {/* Der Aufbau entsteht Schicht für Schicht, wenn die Stationen in Reihenfolge abgelaufen werden */}
      {/* 1 Trennvlies */}
      {schritt >= 1 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
          <planeGeometry args={[S + 0.6, S + 0.6]} /><meshLambertMaterial color="#5c6b4f" />
        </mesh>
      )}
      {/* 2 Schotter 0/32 */}
      {schritt >= 2 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.014} receiveShadow>
          <planeGeometry args={[S, S]} /><meshLambertMaterial color="#8a8a86" />
        </mesh>
      )}
      {/* 3 Leistensteine (Einfassung) */}
      {schritt >= 3 && [half, -half].map((z, i) => (
        <mesh key={'h' + i} position={[0, 0.06, z]} castShadow receiveShadow>
          <boxGeometry args={[S + 2 * b, 0.14, b]} /><meshLambertMaterial color="#9a9a9a" />
        </mesh>
      ))}
      {schritt >= 3 && [half, -half].map((x, i) => (
        <mesh key={'v' + i} position={[x, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[b, 0.14, S]} /><meshLambertMaterial color="#9a9a9a" />
        </mesh>
      ))}
      {/* 4 Splittbettung */}
      {schritt >= 4 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.016} receiveShadow>
          <planeGeometry args={[S - 0.4, S - 0.4]} /><meshLambertMaterial color="#c9c6bd" />
        </mesh>
      )}
      {/* 5 Verbundpflaster */}
      {schritt >= 5 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
          <planeGeometry args={[S - 0.4, S - 0.4]} /><meshLambertMaterial map={pflaster} />
        </mesh>
      )}
      {/* 6 Fugensand-Schimmer = fertig */}
      {schritt >= 6 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.021}>
          <planeGeometry args={[S - 0.4, S - 0.4]} /><meshBasicMaterial color="#cbb58a" transparent opacity={0.14} />
        </mesh>
      )}
      {/* Bauablauf-Tafel am hinteren Rand, zeigt zum ankommenden Spieler */}
      <group position={[0, 0, half + 1.6]} rotation-y={Math.PI}>
        <mesh position={[-1.7, 1.0, 0]}><cylinderGeometry args={[0.05, 0.05, 2, 8]} /><meshLambertMaterial color="#777" /></mesh>
        <mesh position={[1.7, 1.0, 0]}><cylinderGeometry args={[0.05, 0.05, 2, 8]} /><meshLambertMaterial color="#777" /></mesh>
        <mesh position={[0, 1.75, 0.03]}>
          <planeGeometry args={[3.6, 2.2]} /><meshBasicMaterial map={tafel} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* ── Lieferung an der Zufahrt: Palette mit Material + Lieferschein-Klemmbrett ── */}
      <group position={[-3.2, 0, -half - 2.2]} rotation-y={Math.PI}>
        {/* Palette + Materialstapel */}
        <Baupalette position={[0, 0, 0]} />
        <mesh position={[0, 0.22, 0]} castShadow><boxGeometry args={[0.9, 0.4, 0.7]} /><meshLambertMaterial color="#8a8a8a" /></mesh>
        <mesh position={[0.1, 0.5, 0.05]} castShadow><boxGeometry args={[0.8, 0.28, 0.6]} /><meshLambertMaterial color="#b9a06a" /></mesh>
        <Baupalette position={[1.1, 0, 0.2]} rotation={0.2} />
        <mesh position={[1.1, 0.2, 0.2]} castShadow><boxGeometry args={[0.85, 0.36, 0.65]} /><meshLambertMaterial color="#9a9a9a" /></mesh>
        {/* Klemmbrett auf Pfosten, zeigt zum ankommenden Mops */}
        <mesh position={[-1.4, 0.75, 0]}><cylinderGeometry args={[0.04, 0.04, 1.5, 8]} /><meshLambertMaterial color="#6b6b6b" /></mesh>
        <group position={[-1.4, 1.35, 0]} rotation-x={-0.18}>
          <mesh position={[0, 0, -0.02]}><boxGeometry args={[1.5, 1.08, 0.04]} /><meshLambertMaterial color="#7a5230" /></mesh>
          <mesh position={[0, 0, 0.01]}><planeGeometry args={[1.4, 1.0]} /><meshBasicMaterial map={lieferschein} toneMapped={false} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0.52, 0.02]}><boxGeometry args={[0.3, 0.08, 0.05]} /><meshLambertMaterial color="#c0c0c0" /></mesh>
        </group>
      </group>

      {/* Schlepper auf dem Platz (Aushub-Maschine; später der Bagger) */}
      <KitModel url="/models/tow_tractor.glb" position={[3.0, 0, 0.5]} targetSize={4.5} rotation={0.5} />
      {/* Bauablauf-Stationen 1..6 entlang der linken Kante (Station 1 am Eingang) */}
      {BAUABLAUF_STATIONEN.map((s, i) => (
        <BauablaufStation key={s.nr} station={s} done={schritt > i}
          position={[-half - 1.3, 0, -half + 1.6 + i * 1.6]} />
      ))}
    </group>
  )
}

function BaustelleAlpha() {
  return (
    <group position={[SITE1_CENTER.x, 0, SITE1_CENTER.z]}>
      {/* ground area (sand/gravel) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow>
        <planeGeometry args={[30, 25]} />
        <meshLambertMaterial color="#C4A870" />
      </mesh>

      {/* Rohbau aus echten 3D-Bauteilen (Kenney) */}
      <Rohbau position={[2, 0, -1]} rotation={0.1} />

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
  return <CharModel url="/models/chars/worker1.glb" position={position} scale={0.04} rotation={0.5} />
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