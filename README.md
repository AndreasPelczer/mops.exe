# MOPS.EXE

Kleiner 3D-Prototyp aus dem Mopsiversum.

Du spielst den Baumops: vom Bauwagen zur Baustelle, Nachweise einsammeln, Checkliste vollständig machen und bei Raffi abgeben.

## Starten

```bash
npm install
npm run dev
```

Dann im Browser öffnen:

```text
http://localhost:3000
```

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

Das Projekt wurde aus einem KI-generierten Workspace aufgeräumt:

- Spielcode liegt direkt im Repo.
- Unbenutzte Prisma-/DB-/Upload-/Tool-Artefakte wurden entfernt.
- Buildfehler werden nicht mehr per `ignoreBuildErrors` versteckt.
- Das Repo ist jetzt als Prototyp lesbar und weiterentwickelbar.

Noch nicht produktionsreif, aber echt spielbar.

