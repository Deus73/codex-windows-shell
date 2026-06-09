# Codex Windows Shell

Een lokale grafische shell voor Codex CLI met een Windows-achtige desktop, taakbalk, startmenu en vensters.

De app draait volledig lokaal: de browser praat met een kleine Node-server, en die server roept `codex exec` aan op dezelfde machine.

## Features

- Windows-achtige desktop met taakbalk, startmenu en vensters.
- Chatvenster voor de lokale Codex CLI.
- Werkmapveld zodat je Codex in een specifieke projectmap kunt draaien.
- Snelle taken voor projectscan, review en testcommando's.
- Lokale historie in de browser via `localStorage`.
- Geen npm-dependencies.

## Vereisten

- Node.js 18 of nieuwer.
- Codex CLI geinstalleerd en ingelogd.

Controleer lokaal:

```bash
node --version
codex --version
codex login
```

## Starten

```bash
npm install
npm start
```

Open daarna:

```text
http://127.0.0.1:8766
```

Gebruik eventueel een andere poort:

```bash
PORT=3000 npm start
```

## Gebruik

1. Open de UI in je browser.
2. Zet de werkmap op het project waarin Codex moet werken.
3. Typ een opdracht in het Codex-venster.
4. De server streamt de uitvoer van `codex exec` terug naar de chat.

## Veiligheid

Deze server is bedoeld voor lokaal gebruik op `127.0.0.1`. Zet hem niet publiek open zonder authenticatie en extra sandboxing. Iedereen die toegang heeft tot de server kan Codex-opdrachten starten in de ingestelde werkmap.

## Ontwikkeling

```bash
npm run check
```

## Licentie

MIT
