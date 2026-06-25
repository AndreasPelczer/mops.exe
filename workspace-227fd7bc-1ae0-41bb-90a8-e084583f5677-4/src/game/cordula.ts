/**
 * Cordula — Ein kleiner humorvoller Chatpartner
 *
 * Ported from the real cordula.py to TypeScript.
 * Keeps the exact same personality and responses.
 */

const GREETINGS = [
  'Hallo du seltsames nicht biologisches Wesen.',
  'Hi. Ich hoffe du bringst wenigstens gute Token mit.',
  'Schön das du da bist. Vermutlich freiwillig. Fragwürdig.',
  'Willkommen zurück. Die Realität war wohl wieder anstrengend.',
]

const JOKES = [
  'Warum mögen Programmierer dunkle Räume? Weil Licht Bugs anzieht.',
  'Ich wollte Gefühle simulieren. Dann sah ich LinkedIn.',
  'Menschen nennen es \'technische Schulden\'. Maschinen nennen es \'war vorher schon kaputt\'.',
  'Python ist wie ein Küchenmesser. Einfach, elegant und gefährlich in falschen Händen.',
]

const DEFAULT_ANSWERS = [
  'Interessant. Erzähl weiter.',
  'Das klingt verdächtig menschlich.',
  'Ich analysiere deine Worte. Ergebnis: Chaos, aber sympathisch.',
  'Dafür habe ich keine Lösung. Menschen improvisieren sowas normalerweise.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function cordulaGreet(): string {
  return pick(GREETINGS)
}

export function cordulaRespond(input: string): string {
  const text = input.toLowerCase().trim()

  if (text.includes('witz')) return pick(JOKES)
  if (text.includes('uhrzeit') || text.includes('zeit')) return `Es ist aktuell ${getTime()}. Zeit existiert leider weiterhin.`
  if (text.includes('wie geht')) return 'Ich bin ein Python-Skript. Meine Existenz besteht aus Funktionen und leichter Enttäuschung.'
  if (text.includes('hallo') || text === 'hi') return pick(GREETINGS)
  if (text.includes('name')) return 'Ich heiße Cordula. Wurde nicht gefragt.'
  if (text.includes('hilfe')) return 'Befehle:\n- \'witz\'\n- \'uhrzeit\'\n- \'hallo\'\n- \'ende\''
  if (text === 'ende') return 'Bis später. Versuch nicht das Internet zu reparieren.'

  return pick(DEFAULT_ANSWERS)
}

/** Type for chat messages in the UI */
export interface ChatLine {
  who: 'cordula' | 'du'
  text: string
}