/* ── Sound-System (WebAudio, komplett synthetisiert – keine Asset-Dateien) ──
   Browser erlauben Audio erst nach einer Nutzer-Geste → initAudio() auf dem
   Start-Klick aufrufen. Alle Klänge werden aus Oszillatoren erzeugt. */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

export function initAudio() {
  if (ctx) { void ctx.resume(); return }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)
}

export function setMuted(m: boolean) {
  enabled = !m
  if (master && ctx) master.gain.value = m ? 0 : 0.35
}
export function isMuted() { return !enabled }

/* Ein Ton mit Hüllkurve (optional Frequenz-Gleiten). */
function tone(freq: number, dur: number, opts: {
  type?: OscillatorType; when?: number; vol?: number; slideTo?: number
} = {}) {
  if (!ctx || !master || !enabled) return
  const { type = 'sine', when = 0, vol = 1, slideTo } = opts
  const t0 = ctx.currentTime + when
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g); g.connect(master)
  osc.start(t0); osc.stop(t0 + dur + 0.02)
}

/* Kurzes Rausch-Element (für „Klonk"/Schutt). */
function noise(dur: number, opts: { when?: number; vol?: number; freq?: number } = {}) {
  if (!ctx || !master || !enabled) return
  const { when = 0, vol = 0.4, freq = 800 } = opts
  const t0 = ctx.currentTime + when
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = freq
  const g = ctx.createGain(); g.gain.value = vol
  src.connect(filt); filt.connect(g); g.connect(master)
  src.start(t0)
}

/* ── Event-Sounds ─────────────────────────────── */
export function playClick()  { tone(520, 0.08, { type: 'square', vol: 0.18 }) }
export function playOpen()   { tone(440, 0.10, { type: 'triangle', vol: 0.25, slideTo: 660 }) }
export function playEquip()  { noise(0.12, { vol: 0.35, freq: 500 }); tone(180, 0.14, { type: 'square', vol: 0.3, slideTo: 120 }) }

export function playCorrect() {
  // aufsteigendes Arpeggio C5–E5–G5
  tone(523, 0.14, { type: 'triangle', vol: 0.3, when: 0 })
  tone(659, 0.14, { type: 'triangle', vol: 0.3, when: 0.10 })
  tone(784, 0.22, { type: 'triangle', vol: 0.3, when: 0.20 })
}
export function playWrong() {
  tone(200, 0.28, { type: 'sawtooth', vol: 0.22, slideTo: 120 })
}
export function playFound() { tone(880, 0.10, { type: 'sine', vol: 0.25, slideTo: 1200 }) }

export function playComplete() {
  // kleine Fanfare C–E–G–C
  const seq = [523, 659, 784, 1046]
  seq.forEach((f, i) => tone(f, 0.30, { type: 'triangle', vol: 0.32, when: i * 0.14 }))
}
