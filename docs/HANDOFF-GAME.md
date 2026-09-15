# Baumops-Spiel — Handoff (Stand: 16.09.2026)

game.baumops.com · Next.js 16 (static export) + react-three-fiber · Deploy = **Push auf `main` → Cloudflare baut `out/` selbst** (kein wrangler-Login nötig, `out/` ist gitignored).

## Level 1: „Die Hofeinfahrt" (in `src/game/GameScene.tsx`)

Ein aufgeräumter, eingezäunter **Bauhof** vor dem Spawn (W = hinein). Alles zentral um die
Hofeinfahrt aus Raphis DXF (`Testhofeinfahrt.dxf`).

**Spielmechanik (lehrreich + Spielziel):** die Einfahrt ist am Anfang nur **Planum (Sand)**.
Läuft man die **6 Stationen in der richtigen Reihenfolge** ab, baut sich Schicht für Schicht auf:
1 Trennvlies → 2 Schotter 0/32 → 3 Randsteine → 4 Splittbettung → 5 Pflaster → 6 Fugen.
Falsche Reihenfolge tut nichts (es zählt nur die *nächste* fällige Station). Erledigte Station = grüner Haken.
Das ist die **Kausalkette** aus iMOPS/DemoSeeder, physisch begehbar.

- Fortschritt: `hofSchritt`-State in der `GameScene`-Hauptkomponente, ausgelöst im `useFrame`
  über `HOF_STATION_POS` (Auslöser auf dem Laufweg, Radius 2,4 m). Durchgereicht:
  `Bauhof → Hofeinfahrt (schritt) → BauablaufStation (done)`.
- Materialien/Codes/DIN + Lieferschein-Mengen kommen 1:1 aus `DemoSeeder.swift` (DEMO-BAU-001),
  Mengen sind als „Richtwert aus 100 m²" markiert (ehrlich: gerechnet, nicht aus dem Seeder).

**Bauteile (Komponenten):** `Bauhof` (Kies-Boden, Tor, Zaun-Perimeter, Fundus, Level) ·
`Hofeinfahrt` (Schichten + Tafel + Lieferschein + Stationen + Schlepper) · `Materiallager`
(Fundus, richtig skaliert) · `Tor`, `ZaunPanel`/`ZaunReihe` (Bauzaun aus Primitiven) ·
`BauablaufStation`. Schilder = Canvas-Texturen (`makeSchildTexture`/`makeTafelTexture`/
`makeLieferscheinTexture`), NUR im `useMemo` erzeugt (SSR hat kein `document`).

## Aufgeräumt (nichts gelöscht — nur aus dem Render genommen, Code bleibt)
- Falsch skalierte, frei stehende Tool-Kits (waren `targetSize=13`) → im **Materiallager** auf ~2,4 m.
- `BaustellePoC` + streuende PathMarker → aus dem Render (Komponenten bleiben).
- Innerer Bauzaun der Einfahrt → durch Perimeter-Zaun ersetzt.
- `Baustelle Alpha` (55/80) bleibt bewusst in der Ferne als „nächste Baustelle" (nicht angefasst,
  wegen der Quest-HUD in `page.tsx`).

## Behobene Bugs
- **Spiegel-Bug:** Tafel + Lieferschein waren vorgespiegelt UND 180° gedreht → standen verkehrt.
  Vorspiegeln entfernt (Drehen allein stellt Text richtig).
- Player-Animation: idle/walk/run/jump State-Machine (Shift = rennen, Space = springen).

## Offen / als Nächstes
- **Baucontainer-GLB** (Meshy) für ein schickes Baubüro (ersetzt die Kenney-`Bauhuette`).
- **Bagger-GLB** (Meshy) für den Aushub; wenn getrennte Teile → Schaufel im Code animierbar.
- Optional: Schritt-Feedback ins HUD (braucht `page.tsx` — bewusst nicht angefasst).
- **Visuelle Abnahme fehlt:** gebaut/getypt/Assets 200 geprüft, aber ohne Browser NICHT visuell
  gesehen. Zu prüfen: Schild-Ausrichtungen, Größen, Zaun-Ecken, Overlaps.

## Deploy
`git push` (nur Andreas) → Cloudflare baut in ~1 Min. Lokal ansehen: `npx serve out` → localhost.
