// Deutsche Rechtschreibprüfung – komplett im Browser mit echtem Hunspell
// (hunspell-asm, WASM) + igerman98-Wörterbuch. Behandelt deutsche Komposita
// korrekt. Daten verlassen den Browser nie.

import { loadModule, type Hunspell } from "hunspell-asm"

import { CURATED_ALLOW } from "./allowlist"
import type { ParsedWorkbook, CellValue } from "./excel"

// igerman98-Wörterbuch als statische Assets unter public/.
const AFF_URL = "/dict/de.aff"
const DIC_URL = "/dict/de.dic"

export type SpellError = {
  rowExcel: number
  name: string | null
  column: string
  text: string
  word: string
  offset: number
  suggestions: string[]
}

export type SpellResult = {
  errors: SpellError[]
  cellsChecked: number
  wordsChecked: number
  columns: string[]
  truncated: boolean
}

const MAX_ERRORS = 2000

// kurze Domänen-/Abkürzungswörter
const BUILTIN_ALLOW = new Set(
  [
    "fnf", "dsgvo", "sose", "wise", "diy", "svg", "url", "id", "idnr",
    "gmbh", "ggf", "bzw", "ca", "etc", "vs", "ok", "ngo", "eu", "usa",
  ].map((w) => w.toLowerCase())
)

let hunspellPromise: Promise<Hunspell> | null = null

export function loadDictionary(): Promise<Hunspell> {
  if (!hunspellPromise) {
    hunspellPromise = (async () => {
      const factory = await loadModule()
      const [affBuf, dicBuf] = await Promise.all([
        fetch(AFF_URL).then((r) => r.arrayBuffer()),
        fetch(DIC_URL).then((r) => r.arrayBuffer()),
      ])
      const affPath = factory.mountBuffer(new Uint8Array(affBuf), "de.aff")
      const dicPath = factory.mountBuffer(new Uint8Array(dicBuf), "de.dic")
      return factory.create(affPath, dicPath)
    })()
  }
  return hunspellPromise
}

// Ganze Zelle überspringen, wenn es offensichtlich keine Prosa ist
function isNonProse(cell: string): boolean {
  const t = cell.trim()
  if (t === "") return true
  if (/[@]/.test(t)) return true // E-Mail
  if (/https?:\/\/|www\./i.test(t)) return true // URL
  if (/^[\d\s.,:;/+()\-–—%€$]+$/.test(t)) return true // nur Zahlen/Satzzeichen
  return false
}

function isSkippableToken(token: string): boolean {
  if (token.length < 3) return true
  // reine Großbuchstaben-Abkürzung (FNF, DIY, DSGVO …)
  if (token === token.toUpperCase() && token.length <= 5) return true
  return false
}

// Buchstabenläufe (inkl. Umlaute/ß); Bindestrich/Apostroph trennen
const WORD_RE = /[\p{L}\p{M}]+/gu

export async function checkWorkbook(
  parsed: ParsedWorkbook,
  ignore: Set<string> = new Set()
): Promise<SpellResult> {
  const hun = await loadDictionary()

  // Allowlist: eingebaut + kuratiert + Personennamen + Kopfzeilen + Ignorierte
  const allow = new Set<string>(BUILTIN_ALLOW)
  for (const w of CURATED_ALLOW) allow.add(w)
  for (const p of parsed.people) {
    for (const w of p.name.matchAll(WORD_RE)) allow.add(w[0].toLowerCase())
  }
  for (const h of parsed.header) {
    for (const w of String(h).matchAll(WORD_RE)) allow.add(w[0].toLowerCase())
  }
  for (const w of ignore) allow.add(w.toLowerCase())

  const suggestCache = new Map<string, string[]>()
  const suggestFor = (word: string): string[] => {
    const key = word.toLowerCase()
    let s = suggestCache.get(key)
    if (!s) {
      s = hun.suggest(word).slice(0, 6)
      suggestCache.set(key, s)
    }
    return s
  }

  const errors: SpellError[] = []
  const columnsWithErrors = new Set<string>()
  let cellsChecked = 0
  let wordsChecked = 0
  let truncated = false

  outer: for (let r = 0; r < parsed.rows.length; r++) {
    const row = parsed.rows[r]
    const nameCell = row?.[parsed.nameIdx]
    const name =
      nameCell == null || String(nameCell).trim() === ""
        ? null
        : String(nameCell).trim()
    const rowExcel = r + 2 // +1 Kopfzeile, +1 für 1-basiert

    for (let c = 0; c < parsed.header.length; c++) {
      const raw: CellValue = row?.[c] ?? null
      if (typeof raw !== "string") continue
      const text = raw
      if (isNonProse(text)) continue
      cellsChecked++

      for (const m of text.matchAll(WORD_RE)) {
        const word = m[0]
        const offset = m.index ?? 0
        if (isSkippableToken(word)) continue
        if (allow.has(word.toLowerCase())) continue
        wordsChecked++
        if (hun.spell(word)) continue

        errors.push({
          rowExcel,
          name,
          column: parsed.header[c] || `Spalte ${c + 1}`,
          text,
          word,
          offset,
          suggestions: suggestFor(word),
        })
        columnsWithErrors.add(parsed.header[c] || `Spalte ${c + 1}`)
        if (errors.length >= MAX_ERRORS) {
          truncated = true
          break outer
        }
      }
    }
  }

  return {
    errors,
    cellsChecked,
    wordsChecked,
    columns: [...columnsWithErrors],
    truncated,
  }
}
