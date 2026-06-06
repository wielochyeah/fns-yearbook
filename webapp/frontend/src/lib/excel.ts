// Client-seitiges Excel-Parsing mit SheetJS + Spaltenerkennung nach Header.
// Portiert die Logik aus slider_chart.py (read_people / _resolve_column).

import * as XLSX from "xlsx"

export type CellValue = string | number | boolean | null

export type Person = {
  name: string
  rowExcel: number // 1-basierte Excel-Zeilennummer
  values: (number | null)[]
}

export type ParsedWorkbook = {
  header: string[]
  rows: CellValue[][] // Datenzeilen (ohne Kopfzeile)
  traits: string[] // erkannte Eigenschafts-Labels
  traitIdx: number[] // Spaltenindizes der Eigenschaften
  nameIdx: number
  people: Person[]
}

export const NAME_COLUMN = "Name"
export const TRAIT_COLUMNS = [
  "Main character energy",
  "Feinschmecker",
  "Bücherwurm",
  "DIY-Talent",
  "Chaos-Level",
]

function normalizeHeader(text: unknown): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "")
}

function colLetterToIndex(spec: string): number | null {
  const s = spec.trim().toUpperCase()
  if (!/^[A-Z]{1,3}$/.test(s)) return null
  let idx = 0
  for (const ch of s) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx - 1
}

function resolveColumn(spec: string, header: string[]): number | null {
  const target = normalizeHeader(spec)
  for (let i = 0; i < header.length; i++) {
    if (header[i] != null && normalizeHeader(header[i]) === target) return i
  }
  return colLetterToIndex(spec)
}

function toNumberOrNull(cell: CellValue): number | null {
  if (cell == null || (typeof cell === "string" && cell.trim() === "")) {
    return null
  }
  const n = typeof cell === "number" ? cell : Number(String(cell).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export async function parseFile(
  file: File,
  nameColumn = NAME_COLUMN,
  traitColumns = TRAIT_COLUMNS
): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error("Das Excel-Sheet ist leer.")

  const grid = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  })
  if (grid.length === 0) throw new Error("Das Excel-Sheet ist leer.")

  const header = (grid[0] ?? []).map((c) => (c == null ? "" : String(c).trim()))
  const dataRows = grid.slice(1)

  // Namensspalte (Fallback: erste Spalte)
  let nameIdx = resolveColumn(nameColumn, header)
  if (nameIdx == null) nameIdx = 0

  // Eigenschaftsspalten
  const traitIdx: number[] = []
  const traits: string[] = []
  for (const spec of traitColumns) {
    const idx = resolveColumn(spec, header)
    if (idx == null) continue
    const label =
      idx >= 0 && idx < header.length && header[idx] ? header[idx] : spec
    traitIdx.push(idx)
    traits.push(label)
  }

  // Fallback: keine konfigurierte Spalte gefunden -> alle Spalten mit Kopfzeile
  if (traitIdx.length === 0) {
    header.forEach((h, i) => {
      if (i !== nameIdx && h) {
        traitIdx.push(i)
        traits.push(h)
      }
    })
  }

  if (traitIdx.length === 0) {
    const available = header.filter((h) => h)
    throw new Error(
      `Keine passenden Eigenschaftsspalten gefunden. Vorhandene Kopfzeilen: ${available.join(
        ", "
      )}`
    )
  }

  const people: Person[] = []
  dataRows.forEach((row, i) => {
    const nameCell = row?.[nameIdx]
    if (nameCell == null || String(nameCell).trim() === "") return
    people.push({
      name: String(nameCell).trim(),
      rowExcel: i + 2, // +1 Kopfzeile, +1 für 1-basiert
      values: traitIdx.map((c) => toNumberOrNull(row?.[c] ?? null)),
    })
  })

  return { header, rows: dataRows, traits, traitIdx, nameIdx, people }
}
