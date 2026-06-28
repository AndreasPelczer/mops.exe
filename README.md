# MOPS.EXE

Kleiner 3D-Prototyp aus dem Mopsiversum.

Du spielst den Baumops: vom Bauwagen zur Baustelle, Nachweise einsammeln, Checkliste vollständig machen und bei Raffi abgeben.

## Starten (Entwicklung)

```bash
npm install
npm run dev
```

Dann im Browser öffnen:

```text
http://localhost:3000
```

## Bauen & Deployen (statisch)

Das Spiel ist rein clientseitig (Three.js). `next.config.ts` nutzt `output: "export"`,
der Build erzeugt fertige statische Dateien in `out/` — kein laufender Server nötig.

```bash
npm run build      # -> erzeugt out/
npm run preview    # lokal testen (npx serve out)
```

Deploy-Ziel: **game.baumops.com** via Cloudflare Pages — Build-Command `npm run build`,
Output-Verzeichnis `out`. Alternativ `out/` hinter dem Cloudflare-Tunnel statisch ausliefern.

## Steuerung

```text
WASD       laufen
Leertaste  springen
E          interagieren
F          Foto/Nachweis
ESC        Dialog schließen
```

## Spielstand

Aktueller Loop:

1. Mit Raffi am Bauwagen sprechen.
2. Aufgabe „Bodenplatte Nord“ annehmen.
3. Auf der Baustelle Zustand, Lieferung, Foto, Übergabe und Aufmaß prüfen.
4. Zurück zum Bauwagen.
5. Checkliste abgeben.

## Figuren

- Baumops — kleiner spielbarer Mops
- Raffi — Bauleitung im Bauwagen
- Professor Mops — Baustellenwissen mit Hang zur Vorlesung
- Cordula.py — kleines Terminal-Wesen mit Chat
- Peter — Übergabe auf der Baustelle

## Projektzustand

Das Projekt wurde aus einem KI-generierten Workspace (Z.ai) aufgeräumt:

- Spielcode liegt jetzt direkt im Repo-Root (vorher in `workspace-<uuid>/` verschachtelt).
- Ungenutzte Artefakte entfernt: Prisma/DB, next-auth, z-ai-sdk, Upload-/Download-Screenshots,
  Generator-Logs (`tool-results/`, `worklog.md`), Websocket-Beispiel, Caddyfile, `bun.lock`.
- Auf statischen Export umgestellt (`output: "export"`), Build läuft sauber durch.
- Toolchain auf npm (statt bun).

Bekannte Baustellen:

- `ignoreBuildErrors: true` ist noch aktiv — der Prototyp hat unterdrückte TypeScript-Fehler.
  Die müssten als Nächstes echt aufgeräumt werden, bevor man den Flag rausnimmt.
- Viele ungenutzte shadcn-/Radix-Abhängigkeiten sind noch drin (werden aus dem Bundle
  getreeshaked, könnten aber noch entschlackt werden).

Noch nicht produktionsreif, aber echt spielbar.

