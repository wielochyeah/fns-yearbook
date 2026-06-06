# FNF-Jahrbuch – Web-App

Statische Browser-App (React + Vite + Tailwind + shadcn/ui). **Alles läuft im
Browser** – die hochgeladene Excel-Datei mit personenbezogenen Daten wird
**nie** an einen Server gesendet. Damit ist die App auf jedem Static-Host
(z. B. Vercel) DSGVO-konform betreibbar.

Zwei Seiten:

1. **Charts** – erzeugt pro Person ein Slider-/Likert-SVG.
   - Spalten werden über die Kopfzeile erkannt: `Name` → Dateiname,
     `Main character energy`, `Feinschmecker`, `Bücherwurm`, `DIY-Talent`,
     `Chaos-Level` (Position egal, im echten Sheet z. B. B und S–W).
   - Einstellbar: **Schriftart**, Balken-/Markerfarbe, **transparenter
     Hintergrund** (Default an).
   - SVGs sind content-fit (kein überflüssiger Weißraum).
   - Export: **Ordner wählen** (File System Access API, Chrome/Edge) oder
     **ZIP-Download** (alle Browser inkl. Safari) – sowie Einzel-Download.

2. **Rechtschreibprüfung** – prüft alle Texte des Sheets auf Deutsch.
   - Echtes **Hunspell** (`hunspell-asm`, WASM) mit dem igerman98-Wörterbuch →
     versteht zusammengesetzte Wörter (z. B. „Medienwissenschaft“).
   - Kuratierte Allowlist (Länder/Nationalitäten) + **dauerhafte Ignorier-Liste**
     (localStorage) gegen Eigennamen-Fehlalarme.
   - Treffer nach Person gruppiert, mit Kontext, Vorschlägen und Spaltenfilter.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # -> dist/
npm run preview  # dist lokal testen
```

## Deploy auf Vercel (Region Frankfurt)

- **Root Directory** im Vercel-Projekt auf `webapp/frontend` setzen.
- Framework wird als **Vite** erkannt; Build `npm run build`, Output `dist`.
- `vercel.json` setzt `regions: ["fra1"]` (Frankfurt) und langes Caching für das
  Wörterbuch.

> Hinweis Region: Die App ist rein statisch (keine Serverless Functions).
> Statische Dateien liefert Vercel ohnehin über das globale Edge-Netz aus
> (Frankfurt-Nutzer werden automatisch vom Frankfurt-Edge bedient). `fra1` ist
> als bevorzugte Region gesetzt und greift, sobald jemals Functions ergänzt
> werden.

## Technisches

- Excel-Parsing: SheetJS (`xlsx`), client-seitig.
- SVG-Erzeugung: `src/lib/sliderChart.ts` (Portierung aus `slider_chart.py`),
  Label-Breite per Canvas gemessen.
- Rechtschreibung: `src/lib/spellcheck.ts` (hunspell-asm). Statische Wörterbücher
  unter `public/dict/`:
  - Deutsch: `de-frami.*` – das große **frami**-Wörterbuch (LibreOffice,
    ~258k Einträge), aus ISO8859-1 nach UTF-8 konvertiert (`SET UTF-8`), weil
    hunspell-asm UTF-8 erwartet. Deutlich mehr Wörter als die igerman98-Basis.
  - Englisch: `en.*` (`dictionary-en`) als **Zweitprüfung** – ein Wort gilt nur
    als Fehler, wenn es weder DE noch EN kennt (englische Titel/Namen).
  - Eigener Dateiname `de-frami` (statt `de`), damit der immutable-Cache aus
    `vercel.json` beim Wörterbuch-Wechsel nicht die alte Datei ausliefert.
- `vite.config.ts` enthält ein kleines Plugin, das `hunspell-asm` /
  `emscripten-wasm-loader` patcht: „Namespace-als-Funktion“-Importe (nanoid),
  den CJS-`getroot`-Import sowie den fehlenden ESM-Default-Export des
  Emscripten-Moduls – sonst bricht das Browser-Bundle bzw. das Dev-ESM-Linking
  (Vite 8/rolldown).
- `?demo=1` lädt Beispieldaten (Charts), `?demo=spell` zusätzlich mit
  automatischer Rechtschreibprüfung.
