# FNF-Jahrbuch

Tools rund um das FNF-Jahrbuch: aus einem Excel-Sheet **Slider-/Likert-Charts
als SVG** erzeugen und das Sheet auf **deutsche Rechtschreibung** prüfen.

Es gibt zwei Teile:

## 1. Web-App (Hauptprodukt) — [`webapp/frontend/`](webapp/frontend/)

Statische Browser-App (React + Vite + Tailwind + shadcn/ui). **Alles läuft im
Browser**, die Excel-Daten werden nie hochgeladen → DSGVO-konform, auf Vercel
hostbar.

- **Charts**: pro Person ein SVG. Spaltenerkennung über die Kopfzeile
  (`Name` + `Main character energy`, `Feinschmecker`, `Bücherwurm`,
  `DIY-Talent`, `Chaos-Level`). Einstellbar: Schriftart, Farben, transparenter
  Hintergrund. Export als Ordner (Chrome/Edge) oder ZIP.
- **Rechtschreibprüfung**: echtes Hunspell (WASM) mit deutschem Wörterbuch,
  versteht Komposita; Allowlist (Länder etc.) + dauerhafte Ignorier-Liste.

```bash
cd webapp/frontend
npm install
npm run dev          # http://localhost:5173
```

Details & Deploy: [`webapp/frontend/README.md`](webapp/frontend/README.md).

## 2. Python-CLI (Bonus) — [`slider_chart.py`](slider_chart.py)

Erzeugt dieselben Slider-Charts ohne Browser, direkt aus der Kommandozeile.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python make_sample.py                                  # Beispiel-Excel
python slider_chart.py example/beispiel.xlsx -o output # SVGs erzeugen
```

## Projektstruktur

```
.
├── slider_chart.py          # CLI: Excel -> SVG
├── make_sample.py           # erzeugt example/beispiel.xlsx
├── requirements.txt
├── example/beispiel.xlsx    # Beispieldaten (echtes Sheet-Format + Freitext)
└── webapp/frontend/         # die Web-App (Charts + Rechtschreibprüfung)
```
# fns-yearbook
