'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Press_Start_2P } from 'next/font/google'
import GameScene, { type ChecklistState } from '@/game/GameScene'
import { cordulaGreet, cordulaRespond, type ChatLine } from '@/game/cordula'

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'] })

const CAM_H = 2.5
const CAM_D = 5.5

/* ── Professor's Lecture ──────────────────────── */
const PROFESSOR_TEXT = [
  'Wissen Sie, diese Technik wurde bereits von den R\u00f6mern verwendet.',
  '',
  'Der opus caementicium \u2014 r\u00f6mischer Beton \u2014 wurde erstmals um 200 v. Chr. in Rom dokumentiert. Die R\u00f6mer mischten gebrannten Kalk mit Sand und vulkanischer Asche, dem sogenannten Pozzolan.',
  '',
  'Der Pantheon in Rom, erbaut unter Kaiser Hadrian um 125 n. Chr., besitzt die gr\u00f6\u00dfte unbewehrte Betonkuppel der Welt \u2014 43,3 Meter Durchmesser.',
  '',
  'Auch die R\u00f6mer hatten bereits ein System der Dokumentation. Jeder Bauabschnitt wurde von einem curator operis \u00fcberwacht.',
  '',
  'Interessant ist auch die r\u00f6mische Stra\u00dfenbauweise. Die Via Appia, 312 v. Chr. begonnen, verwendet eine Mehrschichtstruktur.',
  '',
  'Man k\u00f6nnte sagen \u2014 und hier muss ich etwas ausf\u00fchren \u2014 dass die Grundprinzipien des Bauens sich seit 2000 Jahren nicht wesentlich ge\u00e4ndert haben.',
  '',
  'Im R\u00f6mischen Reich war ein Bauvorhaben erst dann abgeschlossen, wenn der Prokurator die Unterschrift gesetzt hatte. Ohne Unterschrift gab es keine Bezahlung.',
  '',
  'Heute nennen wir das \u201eQualit\u00e4tssicherung\u201c. Die R\u00f6mer nannten es \u201eLuxus\u201c.',
  '',
  'Man k\u00f6nnte auch \u00fcber die r\u00f6mischen Heizsysteme sprechen \u2014 die hypokausten \u2014 aber das w\u00fcrde den Rahmen...',
]

/* ═══════════════════════════════════════════════ */

/* ── Decision type ─────────────────────────────── */
interface Decision {
  title: string
  question: string
  options: { label: string; value: string }[]
  correctValue: string
  onSuccess: () => void
}

const EMPTY_CHECKLIST: ChecklistState = {
  zustand: false, nachweis: false, lieferung: false, uebergabe: false, aufmass: false,
}

/* ── Checklist display items ───────────────────── */
const CHECKLIST_ITEMS = [
  { key: 'zustand' as const, label: 'Schalung gepr\u00fcft', icon: '\ud83e\udde9' },
  { key: 'nachweis' as const, label: 'Foto gemacht', icon: '\ud83d\udcf7' },
  { key: 'lieferung' as const, label: 'Lieferung best\u00e4tigt', icon: '\ud83d\udce6' },
  { key: 'uebergabe' as const, label: '\u00dcbergabe erfolgt', icon: '\ud83d\udcdd' },
  { key: 'aufmass' as const, label: 'Aufma\u00df erstellt', icon: '\ud83d\udcf0' },
]

/* ═══════════════════════════════════════════════ */

export default function Home() {
  const [notification, setNotification] = useState<string | null>(null)
  const [nearObject, setNearObject] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  /* ── Quest State ─────────────────────────────── */
  // 0 = no quest, talk to Raffi
  // 1 = quest active: do checklist
  // 2 = quest delivered (success or fail)
  const [questStep, setQuestStep] = useState(0)
  const [checklist, setChecklist] = useState<ChecklistState>({ ...EMPTY_CHECKLIST })
  const [aufmassWalked, setAufmassWalked] = useState<string[]>([])
  const [evidence, setEvidence] = useState<string[]>([])
  const [vertrauen, setVertrauen] = useState(0)
  const [questFailed, setQuestFailed] = useState(false)

  /* ── Decision state ─────────────────────────── */
  const [decision, setDecision] = useState<Decision | null>(null)

  /* ── Dialog state ───────────────────────────── */
  const [dialog, setDialog] = useState<'raffi' | 'professor' | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [cordulaAwake, setCodulaAwake] = useState(false)
  const cordulaCooldown = useRef(false)

  /* ── Cordula chat state ─────────────────────── */
  const [chatLines, setChatLines] = useState<ChatLine[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── helpers ─────────────────────────────────── */
  const notify = useCallback((msg: string, ms = 2800) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), ms)
  }, [])

  const addEvidence = useCallback((item: string) => {
    setEvidence(prev => {
      if (prev.includes(item)) return prev
      return [...prev, item]
    })
  }, [])

  const stabilityPercent = Object.values(checklist).filter(Boolean).length / 5 * 100

  /* ── ESC handler ────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (decision) { setDecision(null); return }
        setDialog(null)
        if (showTerminal) {
          setShowTerminal(false)
          setTimeout(() => {
            setCodulaAwake(false)
            cordulaCooldown.current = false
          }, 500)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showTerminal, decision])

  /* ── Interaction handler ────────────────────── */
  const handleInteract = useCallback((type: string) => {
    switch (type) {
      case 'zustand':
        if (checklist.zustand) { notify('BEREITS GEPR\u00dcFT'); return }
        setDecision({
          title: 'SCHALUNG NORD',
          question: 'Wie ist der Zustand der Schalung?',
          options: [
            { label: 'Steht.', value: 'steht' },
            { label: 'Steht nicht.', value: 'steht_nicht' },
            { label: 'Kann ich nicht beurteilen.', value: 'weiss_nicht' },
          ],
          correctValue: 'steht',
          onSuccess: () => {
            setChecklist(c => ({ ...c, zustand: true }))
            addEvidence('Zustand: Schalung steht')
            notify('ZUSTAND GEMELDET')
          },
        })
        break

      case 'lieferung':
        if (checklist.lieferung) { notify('BEREITS GEPR\u00dcFT'); return }
        setDecision({
          title: 'LIEFERUNG',
          question: 'Ist die Lieferung vorhanden?',
          options: [
            { label: 'Lieferung vorhanden.', value: 'vorhanden' },
            { label: 'Lieferung fehlt.', value: 'fehlt' },
          ],
          correctValue: 'vorhanden',
          onSuccess: () => {
            setChecklist(c => ({ ...c, lieferung: true }))
            addEvidence('Lieferung best\u00e4tigt')
            notify('LIEFERUNG BEST\u00c4TIGT')
          },
        })
        break

      case 'foto': {
        if (checklist.nachweis) { notify('BEREITS GEMACHT'); return }
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setChecklist(c => ({ ...c, nachweis: true }))
        addEvidence(`Foto Bodenplatte ${time}`)
        notify('KLIK\nNACHWEIS: FOTO BODENPLATTE', 2500)
        break
      }

      case 'peter':
        if (checklist.uebergabe) { notify('SCHON ERLEDIGT'); return }
        setDecision({
          title: '\u00dcBERGABE',
          question: 'Hat Peter die Arbeiten \u00fcbernommen?',
          options: [
            { label: 'Ja.', value: 'ja' },
            { label: 'Nein.', value: 'nein' },
            { label: 'Wei\u00df ich nicht.', value: 'weiss_nicht' },
          ],
          correctValue: 'ja',
          onSuccess: () => {
            setChecklist(c => ({ ...c, uebergabe: true }))
            addEvidence('\u00dcbergabe an Peter')
            notify('\u00dcBERGABE BEST\u00c4TIGT')
          },
        })
        break

      case 'aufmassA':
      case 'aufmassB':
      case 'aufmassC': {
        const point = type.replace('aufmass', '') // 'A', 'B', or 'C'
        if (aufmassWalked.includes(point)) { notify('BEREITS GEMESSEN'); return }
        setAufmassWalked(prev => {
          const next = [...prev, point]
          if (next.length === 3) {
            setChecklist(c => ({ ...c, aufmass: true }))
            addEvidence('Aufma\u00df erstellt')
            notify('AUFMA\u00df ERSTELLT')
          } else {
            notify(`MESSPUNKT ${point} (${next.length}/3)`)
          }
          return next
        })
        break
      }
    }
  }, [checklist, aufmassWalked, notify, addEvidence])

  /* ── Raffi dialog ──────────────────────────── */
  const handleRaffi = useCallback(() => {
    setDialog('raffi')
  }, [])

  const handleAcceptQuest = useCallback(() => {
    setQuestStep(1)
    setChecklist({ ...EMPTY_CHECKLIST })
    setAufmassWalked([])
    setEvidence([])
    setQuestFailed(false)
    setDialog(null)
    notify('AUFGABE: BODENPLATTE NORD PR\u00dcFEN', 3500)
  }, [notify])

  const handleDeliverQuest = useCallback(() => {
    const done = Object.values(checklist).every(Boolean)
    if (done) {
      setQuestStep(2)
      setDialog(null)
      setVertrauen(v => v + 1)
      notify('BAUSTELLE FREIGEGEBEN')
      setTimeout(() => notify('STABILIT\u00c4T 100%'), 1800)
      setTimeout(() => notify('+1 VERTRAUEN'), 3600)
    } else {
      setQuestFailed(true)
      setVertrauen(v => Math.max(0, v - 1))
      notify('WARST FAST FERTIG.', 3000)
    }
  }, [checklist, notify])

  /* ── Professor ─────────────────────────────── */
  const handleProfessor = useCallback(() => {
    setDialog('professor')
  }, [])

  /* ── Cordula ──────────────────────────────── */
  const handleCordula = useCallback(() => {
    if (cordulaCooldown.current) return
    const greeting = cordulaGreet()
    setChatLines([{ who: 'cordula', text: greeting }])
    setChatInput('')
    setCodulaAwake(true)
    setShowTerminal(true)
    cordulaCooldown.current = true
    const timeout = setTimeout(() => {
      setShowTerminal(false)
      setTimeout(() => {
        setCodulaAwake(false)
        cordulaCooldown.current = false
      }, 500)
    }, 45000)
    return () => clearTimeout(timeout)
  }, [])

  const handleChatSubmit = useCallback(() => {
    const text = chatInput.trim()
    if (!text) return
    const response = cordulaRespond(text)
    setChatLines(prev => [...prev, { who: 'du', text }, { who: 'cordula', text: response }])
    setChatInput('')
    if (text.toLowerCase() === 'ende') {
      setTimeout(() => {
        setShowTerminal(false)
        setTimeout(() => {
          setCodulaAwake(false)
          cordulaCooldown.current = false
        }, 500)
      }, 1200)
    }
  }, [chatInput, chatLines])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLines])
  useEffect(() => { if (showTerminal) setTimeout(() => inputRef.current?.focus(), 150) }, [showTerminal])

  const handleNear = useCallback((obj: string | null) => setNearObject(obj), [])

  /* ── Prompt text ───────────────────────────── */
  const promptText = nearObject === 'raffi'
    ? (questStep === 0 ? '[E] MIT RAFFI SPRECHEN'
       : questStep === 1 ? '[E] CHECKLISTE ABGEBEN'
       : '[E] MIT RAFFI SPRECHEN')
    : nearObject === 'zustand' ? '[E] SCHALUNG PR\u00dcFEN'
    : nearObject === 'lieferung' ? '[E] LIEFERUNG PR\u00dcFEN'
    : nearObject === 'foto' ? '[F] FOTO MACHEN'
    : nearObject === 'peter' ? '[E] \u00dcBERGABE PR\u00dcFEN'
    : nearObject?.startsWith('aufmass') ? `[E] MESSPUNKT ${nearObject.replace('aufmass', '')} AUFNEHMEN`
    : nearObject === 'professor' ? '[E] MIT PROFESSOR MOPS SPRECHEN'
    : nearObject === 'cordula' ? '[E] CORDULA WECKEN'
    : null

  const anyDialogOpen = dialog !== null || showTerminal || decision !== null

  /* ── Raffi dialog content based on quest ──── */
  const raffiTitle = questStep === 0 ? 'NEUE AUFGABE'
    : questStep === 1 ? 'BAUSTELLE ALPHA'
    : questStep === 2 ? 'ABGESCHLOSSEN'
    : 'BAULEITUNG'

  const missingItems = questStep === 1
    ? CHECKLIST_ITEMS.filter(item => !checklist[item.key])
    : []

  /* ═══════════════════════════════════════════ */

  /* ── Title Screen ────────────────────────────── */
  if (!started) {
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center select-none"
        style={{ background: '#1C2B1A' }}
        onClick={() => setStarted(true)}
        onKeyDown={() => setStarted(true)}
        tabIndex={0}
      >
        <div className={`${pixel.className} text-center`}>
          <p className="text-amber-400 text-3xl md:text-5xl mb-4 tracking-wider" style={{ textShadow: '0 0 30px rgba(255,180,0,0.3)' }}>
            MOPS.EXE
          </p>
          <p className="text-amber-200/40 text-[10px] md:text-xs mb-4">
            BAUMOPS CONSTRUCTION GRID
          </p>
          <p className="text-amber-200/25 text-[9px] md:text-[11px] mb-16">
            v0.3 \u2014 BODENPLATTE NORD
          </p>
          <p className="text-amber-300/60 text-[9px] md:text-[11px] animate-pulse">
            KLICK ZUM STARTEN
          </p>
        </div>
      </div>
    )
  }

  /* ── Game UI ────────────────────────────────── */
  return (
    <div
      className="w-screen h-screen relative overflow-hidden select-none"
      style={{ background: '#1C2B1A', cursor: anyDialogOpen ? 'default' : 'none' }}
    >
      <Canvas
        shadows
        gl={{ antialias: false }}
        camera={{ position: [0, CAM_H, -CAM_D], fov: 55, near: 0.1, far: 500 }}
        dpr={1}
      >
        <GameScene
          questStep={questStep}
          checklist={checklist}
          aufmassWalked={aufmassWalked}
          onInteract={handleInteract}
          onRaffiInteract={handleRaffi}
          onProfessorInteract={handleProfessor}
          onCordulaInteract={handleCordula}
          onNearChange={handleNear}
          cordulaAwake={cordulaAwake}
          chaos={false}
        />
      </Canvas>

      {/* ── Crosshair ──────────────────────────── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>

      {/* ═══ MISSION PANEL (top-left) ═══════════ */}
      <div className="absolute top-3 left-4 pointer-events-none z-20">
        <div className={`${pixel.className}`} style={{
          background: 'rgba(10,16,10,0.85)',
          border: '1px solid rgba(255,180,0,0.15)',
          padding: '10px 14px',
          minWidth: '220px',
          borderRadius: '4px',
        }}>
          {/* header */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[8px] text-amber-400/40">MOPS.EXE</p>
            {vertrauen > 0 && (
              <p className="text-[7px] text-amber-300/50">+{vertrauen} VT</p>
            )}
          </div>

          {questStep === 0 && (
            <p className="text-[7px] text-amber-100/25 leading-relaxed">
              Gehe zum Bauwagen und sprich mit Raffi.
            </p>
          )}

          {questStep === 1 && (
            <>
              <p className="text-[8px] text-amber-300/60 mb-1.5">MISSION</p>
              <p className="text-[9px] text-amber-100/80 mb-2">Bodenplatte Nord</p>
              <p className="text-[6px] text-amber-200/30 mb-1.5">STATUS:</p>
              {CHECKLIST_ITEMS.map(item => (
                <div key={item.key} className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[8px]">{checklist[item.key] ? '\u2611' : '\u2610'}</span>
                  <span className={`text-[7px] ${checklist[item.key] ? 'text-green-400/70' : 'text-amber-100/30'}`}>
                    {item.label}
                  </span>
                </div>
              ))}

              {/* Stabilitaet bar */}
              <div className="mt-3">
                <p className="text-[7px] text-amber-200/40 mb-1">STABILIT\u00c4T</p>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px', height: '8px', width: '100%' }}>
                  <div style={{
                    background: stabilityPercent === 100 ? '#4CAF50' : stabilityPercent >= 60 ? '#E8842A' : '#CC3333',
                    borderRadius: '2px', height: '8px',
                    width: `${stabilityPercent}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <p className={`text-[7px] mt-0.5 ${stabilityPercent === 100 ? 'text-green-400/60' : 'text-amber-200/30'}`}>
                  {stabilityPercent === 100 ? 'STABIL' : `${Math.round(stabilityPercent)} %`}
                </p>
              </div>
            </>
          )}

          {questStep === 2 && (
            <>
              <p className="text-[8px] text-green-400/60 mb-1">ABGESCHLOSSEN</p>
              <p className="text-[7px] text-amber-100/30 leading-relaxed">
                Bodenplatte Nord freigegeben.
              </p>
              <div className="mt-2">
                <div style={{ background: '#4CAF50', borderRadius: '2px', height: '8px', width: '100%' }} />
              </div>
              <p className="text-[7px] text-green-400/50 mt-0.5">100 % STABIL</p>
            </>
          )}
        </div>
      </div>

      {/* ── Evidence Panel (bottom-left) ──────── */}
      {evidence.length > 0 && (
        <div className="absolute bottom-12 left-4 pointer-events-none z-20">
          <div className={`${pixel.className}`} style={{
            background: 'rgba(10,16,10,0.75)',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 12px',
            borderRadius: '4px',
          }}>
            <p className="text-[6px] text-amber-300/30 mb-1">MAPPE</p>
            {evidence.map((item, i) => (
              <p key={i} className="text-[7px] text-amber-100/45 mb-0.5">
                {'> '}{item}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Aufmass progress (bottom-right) ─── */}
      {questStep === 1 && aufmassWalked.length > 0 && aufmassWalked.length < 3 && (
        <div className="absolute bottom-12 right-4 pointer-events-none z-20">
          <div className={`${pixel.className}`} style={{
            background: 'rgba(10,16,10,0.7)',
            padding: '6px 10px',
            borderRadius: '4px',
          }}>
            <p className="text-[7px] text-cyan-300/50">AUFMASS</p>
            <p className="text-[8px] text-cyan-200/60">{aufmassWalked.length} / 3</p>
          </div>
        </div>
      )}

      {/* ── Notification ───────────────────────── */}
      {notification && (
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div
            className={`${pixel.className} text-amber-400 text-xs md:text-lg text-center px-5 py-3 md:px-8 md:py-4 whitespace-pre-line`}
            style={{
              background: 'rgba(15,20,12,0.88)',
              border: '2px solid rgba(255,180,0,0.35)',
              boxShadow: '0 0 30px rgba(255,180,0,0.12)',
              animation: 'notifIn 0.3s ease-out',
            }}
          >
            {notification}
          </div>
        </div>
      )}

      {/* ── Interaction Prompt ─────────────────── */}
      {promptText && !anyDialogOpen && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div
            className={`${pixel.className} text-[9px] md:text-[11px] text-amber-100/80 text-center px-4 py-2`}
            style={{
              background: 'rgba(15,20,12,0.65)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {promptText}
          </div>
        </div>
      )}

      {/* ═══ DECISION MODAL ════════════════════════ */}
      {decision && (
        <div className="absolute inset-0 flex items-center justify-center z-40" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div
            className={`${pixel.className} p-5 md:p-6`}
            style={{
              background: 'rgba(18,14,10,0.97)',
              border: '2px solid rgba(255,180,0,0.3)',
              minWidth: '280px',
              maxWidth: '400px',
              boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
            }}
          >
            <p className="text-amber-500/60 text-[7px] mb-1">{decision.title}</p>
            <p className="text-amber-100/85 text-[9px] md:text-[10px] mb-5 leading-relaxed">
              {decision.question}
            </p>
            <div className="flex flex-col gap-2">
              {decision.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (opt.value === decision.correctValue) {
                      setDecision(null)
                      decision.onSuccess()
                    } else {
                      notify('FALSCHE EINSCH\u00c4TZUNG.\nNochmal pr\u00fcfen.', 2500)
                      setDecision(null)
                    }
                  }}
                  className={`${pixel.className} text-[8px] md:text-[9px] text-amber-100/70 text-left px-4 py-2.5 cursor-pointer hover:text-amber-100 hover:bg-white/5 transition-colors`}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDecision(null)}
              className={`${pixel.className} text-[7px] text-amber-400/30 cursor-pointer hover:text-amber-400/60 mt-3`}
              style={{ background: 'none', border: 'none' }}
            >
              [ABBRUCH]
            </button>
          </div>
        </div>
      )}

      {/* ── Raffi Dialog ──────────────────────── */}
      {dialog === 'raffi' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
          <div className={`${pixel.className} p-4 md:p-5`} style={dialogBoxStyle}>
            <p className="text-amber-500/70 text-[8px] mb-2">RAFFI <span className="text-amber-500/30">&mdash; BAULEITUNG</span></p>

            {questStep === 0 && (
              <>
                <p className="text-amber-100/90 text-[9px] md:text-[11px] mb-4 leading-relaxed">
                  &ldquo;Bodenplatte Nord muss gepr&uuml;ft werden. Zustand, Nachweis, Lieferung, &Uuml;bergabe, Aufma&szlig;.
                  Alles dokumentieren. Nicht vergessen.&rdquo;
                </p>
                <button onClick={handleAcceptQuest} className={dialogBtnStyle(pixel.className)}>
                  [AUFGABE ANNEHMEN]
                </button>
              </>
            )}

            {questStep === 1 && (
              <>
                <p className="text-amber-100/80 text-[8px] md:text-[10px] mb-3 leading-relaxed">
                  {questFailed
                    ? '&ldquo;Warst fast fertig.&rdquo;'
                    : '&ldquo;Hast du alles?&rdquo;'
                  }
                </p>
                {/* Checklist overview */}
                <div className="mb-3" style={{ borderTop: '1px solid rgba(255,180,0,0.15)', paddingTop: '8px' }}>
                  {CHECKLIST_ITEMS.map(item => (
                    <div key={item.key} className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[8px] ${checklist[item.key] ? 'text-green-400/70' : 'text-red-400/50'}`}>
                        {checklist[item.key] ? '\u2713' : '\u2717'}
                      </span>
                      <span className={`text-[7px] ${checklist[item.key] ? 'text-green-400/50' : 'text-red-300/40'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                {questFailed && missingItems.length > 0 && (
                  <p className="text-red-400/50 text-[7px] mb-3">
                    Es fehlt: {missingItems.map(i => i.label).join(', ')}
                  </p>
                )}
                <button onClick={handleDeliverQuest} className={dialogBtnStyle(pixel.className)}>
                  [CHECKLISTE ABGEBEN]
                </button>
              </>
            )}

            {questStep === 2 && (
              <>
                <p className="text-amber-100/90 text-[9px] md:text-[11px] mb-4 leading-relaxed">
                  &ldquo;Gute Arbeit, kleiner Mops. Bodenplatte Nord ist freigegeben. Ruhe dich aus.&rdquo;
                </p>
                <button onClick={() => setDialog(null)} className={`${pixel.className} text-[8px] text-amber-400/40 cursor-pointer hover:text-amber-400`} style={{ background: 'none', border: 'none' }}>
                  [SCHLIESSEN]
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Professor Mops Dialog ──────────────── */}
      {dialog === 'professor' && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className={`${pixel.className} w-[90vw] max-w-lg max-h-[70vh] p-4 md:p-5 flex flex-col`}
            style={{
              background: 'rgba(20,16,10,0.97)',
              border: '2px solid rgba(107,68,35,0.6)',
              boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-amber-600/70 text-[8px]">PROFESSOR MOPS</p>
              <button
                onClick={() => setDialog(null)}
                className="text-amber-400/50 text-[10px] cursor-pointer hover:text-amber-400"
                style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}
              >
                [ESC]
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#6B4423 transparent' }}>
              {PROFESSOR_TEXT.map((line, i) => (
                <p
                  key={i}
                  className="text-amber-100/85 text-[8px] md:text-[9px] leading-relaxed mb-2"
                  style={line === '' ? { height: '0.5rem' } : {}}
                >
                  {line}
                </p>
              ))}
              <p className="text-amber-400/30 text-[8px] mt-2">...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Cordula Interactive Terminal ────────── */}
      {showTerminal && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="w-[88vw] max-w-lg">
            <div style={{ background: '#0A0A0A', border: '2px solid #333', borderRadius: '4px' }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#1A1A1A', borderBottom: '1px solid #333' }}>
                <p className="text-[9px]" style={{ color: '#00FF41', fontFamily: 'monospace' }}>cordula.py &mdash; mopsiversum</p>
                <button
                  onClick={() => {
                    setShowTerminal(false)
                    setTimeout(() => {
                      setCodulaAwake(false)
                      cordulaCooldown.current = false
                    }, 500)
                  }}
                  className="flex gap-1.5 cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70 hover:bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </button>
              </div>
              <pre className="px-3 pt-2 pb-1 text-[8px]" style={{ color: '#00AA30', fontFamily: 'monospace' }}>
{'>>> wake_up()\n# SleepState.INDEFINITE\n# cordula v1.0 geladen\n'}
              </pre>
              <div
                className="px-3 overflow-y-auto"
                style={{
                  fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.6',
                  maxHeight: '38vh', scrollbarWidth: 'thin', scrollbarColor: '#00FF41 #0A0A0A',
                }}
              >
                {chatLines.map((line, i) => (
                  <div key={i} style={{ marginBottom: '4px' }}>
                    <span style={{ color: line.who === 'cordula' ? '#00FF41' : '#87CEEB', fontWeight: 'bold' }}>
                      {line.who === 'cordula' ? 'cordula' : 'du'}
                    </span>
                    <span style={{ color: '#555' }}>{': '}</span>
                    <span style={{ color: '#00FF41' }}>{line.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center px-3 py-2" style={{ borderTop: '1px solid #222' }}>
                <span style={{ color: '#00FF41', fontFamily: 'monospace', fontSize: '10px', marginRight: '6px' }}>{'>>> '}</span>
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleChatSubmit()
                    e.stopPropagation()
                  }}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#00FF41', fontFamily: 'monospace', fontSize: '10px',
                    flex: 1, caretColor: '#00FF41',
                  }}
                  placeholder="tippe etwas..."
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>
            <p className={`${pixel.className} text-center text-amber-200/30 text-[7px] mt-2`}>
              TIPPE &quot;HILFE&quot; F&Uuml;R BEFEHLE &mdash; &quot;ENDE&quot; ZUM GEHEN &mdash; ESC ZUM SCHLIESSEN
            </p>
          </div>
        </div>
      )}

      {/* ── Controls Hint ──────────────────────── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <p className={`${pixel.className} text-[7px] md:text-[8px] text-white/20 text-center`}>
          WASD &mdash; LAUFEN &nbsp;&nbsp; LEERTASTE &mdash; SPRINGEN &nbsp;&nbsp; E &mdash; INTERAGIEREN &nbsp;&nbsp; F &mdash; FOTO &nbsp;&nbsp; ESC &mdash; SCHLIESSEN
        </p>
      </div>
    </div>
  )
}

/* ── Shared styles ─────────────────────────────── */
const dialogBoxStyle: React.CSSProperties = {
  background: 'rgba(22,18,14,0.96)',
  border: '2px solid rgba(232,132,42,0.5)',
  minWidth: '280px',
  maxWidth: '420px',
  boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
}

function dialogBtnStyle(fontClass: string): React.CSSProperties {
  return {
    background: 'rgba(180,100,20,0.7)',
    border: '2px solid rgba(255,180,0,0.4)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}