#!/usr/bin/env python3
"""
Slider-/Likert-Chart Generator
===============================

Liest ein Excel-Sheet ein und erzeugt pro Person (Zeile) ein SVG im Stil
eines horizontalen Slider-/Likert-Vergleichscharts:

    Eigenschaftsname  ▕████████▌|███████████▏

  * graublauer, abgerundeter Balken (eine Spur)
  * pinkfarbener, vertikaler Marker (Pille) an der Position des Prozentwerts
  * fett-schwarzes Label links neben dem Balken

Erwartetes Excel-Format (erste Zeile = Kopfzeile):

Die Spalten werden über ihren KOPFZEILEN-NAMEN gefunden – egal an welcher
Position sie stehen. Standardmäßig gesucht werden (siehe NAME_COLUMN /
TRAIT_COLUMNS unten):

    Name                  <- wird zum Dateinamen des SVG
    Main character energy <- Eigenschaft  (0-100 %)
    Feinschmecker         <- Eigenschaft  (0-100 %)
    Bücherwurm            <- Eigenschaft  (0-100 %)
    DIY-Talent            <- Eigenschaft  (0-100 %)
    Chaos-Level           <- Eigenschaft  (0-100 %)

Damit funktioniert sowohl ein schlankes Sheet (Name in A, Werte in B–F) als
auch das echte Formular-Export-Sheet (Name in Spalte B, Werte in S–W).
Alternativ kann in NAME_COLUMN/TRAIT_COLUMNS auch ein Spaltenbuchstabe
("B", "S", …) angegeben werden.

Aufruf:
    python slider_chart.py example/beispiel.xlsx -o output
    python slider_chart.py meine_daten.xlsx --out svgs
"""

from __future__ import annotations

import argparse
import os
import re
import sys

try:
    import openpyxl
except ModuleNotFoundError:  # pragma: no cover
    sys.exit(
        "Fehler: 'openpyxl' ist nicht installiert.\n"
        "Installiere es mit:  pip install openpyxl"
    )


# --------------------------------------------------------------------------- #
#  KONFIGURATION  –  hier Farben & Maße anpassen (Optik wie im Referenzbild)
# --------------------------------------------------------------------------- #
class Config:
    # Farben ---------------------------------------------------------------- #
    BAR_COLOR = "#8B99AD"      # graublauer Balken (Spur)
    MARKER_COLOR = "#E72585"   # pinker Marker
    TEXT_COLOR = "#000000"     # Label-Text (fett, schwarz)
    BG_COLOR = "#FFFFFF"       # Hintergrund

    # Schrift --------------------------------------------------------------- #
    FONT_FAMILY = "Arial, Helvetica, sans-serif"
    FONT_WEIGHT = "bold"
    LABEL_FONT_SIZE = 30       # px

    # Maße ------------------------------------------------------------------ #
    PAD = 44                   # Außenabstand rundum (px)
    ROW_HEIGHT = 66            # Höhe einer Zeile (px)
    GAP = 34                   # Abstand Label -> Balken (px)
    BAR_WIDTH = 500            # Länge des Balkens (px)
    BAR_HEIGHT = 30            # Höhe des Balkens (px)
    BAR_RADIUS = 9             # Eckenrundung des Balkens (px)
    MARKER_WIDTH = 9           # Breite des Markers (px)
    MARKER_OVERHANG = 7        # wie weit der Marker oben/unten übersteht (px)

    # Sonstiges ------------------------------------------------------------- #
    SHOW_TITLE = False         # Name als Überschrift im Chart anzeigen?
    TITLE_FONT_SIZE = 38       # nur relevant wenn SHOW_TITLE = True


# --------------------------------------------------------------------------- #
#  Hilfsfunktionen
# --------------------------------------------------------------------------- #

# Ungefähre Zeichenbreiten für Arial Bold (in 1/1000 em). Wird nur benutzt,
# um die Breite der Label-Spalte abzuschätzen (Text wird rechtsbündig an den
# Balken gesetzt). Leichte Ungenauigkeit ist unkritisch.
_ADV = {
    " ": 278, "!": 333, '"': 474, "#": 556, "$": 556, "%": 889, "&": 722,
    "'": 238, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
    ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
    "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 333, ";": 333,
    "<": 584, "=": 584, ">": 584, "?": 611, "@": 975,
    "A": 722, "B": 722, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778,
    "H": 722, "I": 278, "J": 556, "K": 722, "L": 611, "M": 833, "N": 722,
    "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722,
    "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
    "a": 556, "b": 611, "c": 556, "d": 611, "e": 556, "f": 333, "g": 611,
    "h": 611, "i": 278, "j": 278, "k": 556, "l": 278, "m": 889, "n": 611,
    "o": 611, "p": 611, "q": 611, "r": 389, "s": 556, "t": 333, "u": 611,
    "v": 556, "w": 778, "x": 556, "y": 556, "z": 500,
    "ä": 556, "ö": 611, "ü": 611, "Ä": 722, "Ö": 778, "Ü": 722, "ß": 611,
}
_ADV_DEFAULT = 611


def approx_text_width(text: str, font_size: float) -> float:
    """Geschätzte Breite eines fett gesetzten Strings in px."""
    units = sum(_ADV.get(ch, _ADV_DEFAULT) for ch in text)
    return units / 1000.0 * font_size


def xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def sanitize_filename(name: str) -> str:
    """Macht aus einem Namen einen sicheren Dateinamen (Umlaute bleiben)."""
    name = name.strip()
    # Pfadtrenner & Steuerzeichen ersetzen
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name)
    name = name.strip(". ")
    return name or "unbenannt"


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# --------------------------------------------------------------------------- #
#  SVG-Erzeugung
# --------------------------------------------------------------------------- #

def build_svg(name: str, traits: list[tuple[str, float]], cfg: Config = Config) -> str:
    """Erzeugt das SVG für eine Person.

    traits: Liste aus (Label, Wert 0-100).
    """
    n = len(traits)

    # Breite der Label-Spalte = breitestes Label
    label_col_w = max(
        (approx_text_width(lbl, cfg.LABEL_FONT_SIZE) for lbl, _ in traits),
        default=0.0,
    )

    bar_x = cfg.PAD + label_col_w + cfg.GAP
    label_right_x = cfg.PAD + label_col_w  # rechte Kante der Label-Spalte

    title_h = (cfg.TITLE_FONT_SIZE + 18) if cfg.SHOW_TITLE else 0

    width = bar_x + cfg.BAR_WIDTH + cfg.PAD
    height = cfg.PAD * 2 + title_h + n * cfg.ROW_HEIGHT

    marker_h = cfg.BAR_HEIGHT + 2 * cfg.MARKER_OVERHANG

    parts: list[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{width:.0f}" height="{height:.0f}" '
        f'viewBox="0 0 {width:.0f} {height:.0f}">'
    )
    # Hintergrund
    parts.append(
        f'<rect x="0" y="0" width="{width:.0f}" height="{height:.0f}" '
        f'fill="{cfg.BG_COLOR}"/>'
    )

    # optionaler Titel (Name)
    if cfg.SHOW_TITLE:
        parts.append(
            f'<text x="{cfg.PAD:.1f}" y="{cfg.PAD + cfg.TITLE_FONT_SIZE:.1f}" '
            f'font-family="{cfg.FONT_FAMILY}" font-weight="{cfg.FONT_WEIGHT}" '
            f'font-size="{cfg.TITLE_FONT_SIZE}" fill="{cfg.TEXT_COLOR}">'
            f'{xml_escape(name)}</text>'
        )

    top = cfg.PAD + title_h
    for i, (label, value) in enumerate(traits):
        value = clamp(float(value), 0.0, 100.0)

        row_center = top + cfg.ROW_HEIGHT / 2 + i * cfg.ROW_HEIGHT
        bar_y = row_center - cfg.BAR_HEIGHT / 2

        # Balken (Spur)
        parts.append(
            f'<rect x="{bar_x:.1f}" y="{bar_y:.1f}" '
            f'width="{cfg.BAR_WIDTH}" height="{cfg.BAR_HEIGHT}" '
            f'rx="{cfg.BAR_RADIUS}" ry="{cfg.BAR_RADIUS}" '
            f'fill="{cfg.BAR_COLOR}"/>'
        )

        # Marker-Position (innerhalb des Balkens gehalten)
        mx_center = bar_x + value / 100.0 * cfg.BAR_WIDTH
        mx_center = clamp(
            mx_center,
            bar_x + cfg.MARKER_WIDTH / 2,
            bar_x + cfg.BAR_WIDTH - cfg.MARKER_WIDTH / 2,
        )
        marker_x = mx_center - cfg.MARKER_WIDTH / 2
        marker_y = bar_y - cfg.MARKER_OVERHANG
        parts.append(
            f'<rect x="{marker_x:.1f}" y="{marker_y:.1f}" '
            f'width="{cfg.MARKER_WIDTH}" height="{marker_h}" '
            f'rx="{cfg.MARKER_WIDTH / 2:.1f}" ry="{cfg.MARKER_WIDTH / 2:.1f}" '
            f'fill="{cfg.MARKER_COLOR}"/>'
        )

        # Label (rechtsbündig, vertikal zentriert)
        baseline = row_center + cfg.LABEL_FONT_SIZE * 0.35
        parts.append(
            f'<text x="{label_right_x:.1f}" y="{baseline:.1f}" '
            f'text-anchor="end" font-family="{cfg.FONT_FAMILY}" '
            f'font-weight="{cfg.FONT_WEIGHT}" font-size="{cfg.LABEL_FONT_SIZE}" '
            f'fill="{cfg.TEXT_COLOR}">{xml_escape(label)}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts)


# --------------------------------------------------------------------------- #
#  Excel einlesen
# --------------------------------------------------------------------------- #

# Standard-Spaltenzuordnung. Jeder Eintrag ist entweder ein Kopfzeilen-NAME
# (bevorzugt, positionsunabhängig) oder ein Spaltenbuchstabe ("B", "S", …).
NAME_COLUMN = "Name"
TRAIT_COLUMNS = [
    "Main character energy",
    "Feinschmecker",
    "Bücherwurm",
    "DIY-Talent",
    "Chaos-Level",
]


def _normalize_header(text: object) -> str:
    """Vereinheitlicht Kopfzeilen für den Vergleich (klein, ohne Leer-/Trennzeichen)."""
    return re.sub(r"[\s\-_]+", "", str(text).strip().lower())


def _col_letter_to_index(spec: str) -> int | None:
    """'A' -> 0, 'B' -> 1, 'S' -> 18, 'AA' -> 26. Sonst None."""
    s = str(spec).strip().upper()
    if not re.fullmatch(r"[A-Z]{1,3}", s):
        return None
    idx = 0
    for ch in s:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _resolve_column(spec: str, header: list) -> int | None:
    """Spaltenindex für eine Spec: erst per Kopfzeilen-Name, sonst per Buchstabe."""
    target = _normalize_header(spec)
    for i, h in enumerate(header):
        if h is not None and _normalize_header(h) == target:
            return i
    return _col_letter_to_index(spec)


def read_people(
    xlsx_path: str,
    name_column: str = NAME_COLUMN,
    trait_columns: list[str] | None = None,
) -> tuple[list[str], list[tuple[str, list[float | None]]]]:
    """Liest das Excel.

    Spalten werden über ihren Kopfzeilen-Namen gefunden (Position egal),
    alternativ über Spaltenbuchstaben.

    Rückgabe: (eigenschafts_labels, [(name, [werte...]), ...])
    """
    if trait_columns is None:
        trait_columns = TRAIT_COLUMNS

    wb = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)
    try:
        ws = wb.active

        rows = ws.iter_rows(values_only=True)
        try:
            header = list(next(rows))
        except StopIteration:
            raise ValueError("Das Excel-Sheet ist leer.")

        # Namensspalte (Fallback: erste Spalte)
        name_idx = _resolve_column(name_column, header)
        if name_idx is None:
            name_idx = 0

        # Eigenschaftsspalten auflösen
        trait_idx: list[int] = []
        trait_labels: list[str] = []
        for spec in trait_columns:
            idx = _resolve_column(spec, header)
            if idx is None:
                print(f"  Hinweis: Spalte '{spec}' nicht gefunden – übersprungen.")
                continue
            if 0 <= idx < len(header) and header[idx] is not None and str(header[idx]).strip():
                label = str(header[idx]).strip()
            else:
                label = str(spec)
            trait_idx.append(idx)
            trait_labels.append(label)

        # Fallback: keine konfigurierte Spalte gefunden -> alle Spalten mit
        # Kopfzeile außer der Namensspalte verwenden.
        if not trait_idx:
            for i, h in enumerate(header):
                if i == name_idx or h is None or str(h).strip() == "":
                    continue
                trait_idx.append(i)
                trait_labels.append(str(h).strip())

        if not trait_idx:
            available = [str(h).strip() for h in header if h is not None and str(h).strip()]
            raise ValueError(
                "Keine passenden Eigenschaftsspalten gefunden. "
                f"Vorhandene Kopfzeilen: {available}"
            )

        people: list[tuple[str, list[float | None]]] = []
        for row in rows:
            if row is None:
                continue
            name_cell = row[name_idx] if name_idx < len(row) else None
            if name_cell is None or str(name_cell).strip() == "":
                continue  # Zeile ohne Namen überspringen
            name = str(name_cell).strip()

            values: list[float | None] = []
            for col in trait_idx:
                cell = row[col] if col < len(row) else None
                if cell is None or (isinstance(cell, str) and cell.strip() == ""):
                    values.append(None)
                else:
                    try:
                        values.append(float(cell))
                    except (TypeError, ValueError):
                        values.append(None)
            people.append((name, values))
    finally:
        wb.close()

    return trait_labels, people


# --------------------------------------------------------------------------- #
#  Hauptprogramm
# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Erzeugt pro Person ein Slider-/Likert-Chart als SVG."
    )
    parser.add_argument("input", help="Pfad zum Excel-Sheet (.xlsx)")
    parser.add_argument(
        "-o", "--out", default="output",
        help="Ausgabeordner für die SVGs (Default: output)",
    )
    args = parser.parse_args(argv)

    if not os.path.isfile(args.input):
        print(f"Fehler: Datei nicht gefunden: {args.input}", file=sys.stderr)
        return 1

    trait_labels, people = read_people(args.input)
    if not people:
        print("Keine Personen-Zeilen im Excel gefunden.", file=sys.stderr)
        return 1

    os.makedirs(args.out, exist_ok=True)

    print(f"Eigenschaften: {', '.join(trait_labels)}")
    used_names: dict[str, int] = {}
    count = 0
    for name, values in people:
        # Fehlende Werte als 0 behandeln (mit Hinweis)
        traits: list[tuple[str, float]] = []
        for label, val in zip(trait_labels, values):
            if val is None:
                print(f"  Hinweis: '{name}' hat keinen Wert für '{label}' -> 0 %")
                val = 0.0
            elif not (0.0 <= val <= 100.0):
                print(
                    f"  Hinweis: '{name}' Wert {val} für '{label}' "
                    f"außerhalb 0-100 -> begrenzt"
                )
            traits.append((label, float(val)))

        svg = build_svg(name, traits)

        base = sanitize_filename(name)
        # Doppelte Namen eindeutig machen
        if base in used_names:
            used_names[base] += 1
            fname = f"{base}_{used_names[base]}.svg"
        else:
            used_names[base] = 0
            fname = f"{base}.svg"

        out_path = os.path.join(args.out, fname)
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(svg)
        print(f"  geschrieben: {out_path}")
        count += 1

    print(f"\nFertig: {count} SVG-Datei(en) in '{args.out}'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
