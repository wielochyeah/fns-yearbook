// Deutsche Rechtschreibprüfung – komplett im Browser mit echtem Hunspell
// (hunspell-asm, WASM) + igerman98-Wörterbuch. Behandelt deutsche Komposita
// korrekt. Daten verlassen den Browser nie.

import { loadModule, type Hunspell } from "hunspell-asm"

import { CURATED_ALLOW } from "./allowlist"
import type { ParsedWorkbook, CellValue } from "./excel"

// Wörterbücher als statische Assets unter public/. Deutsch nutzt das große
// frami-Wörterbuch (LibreOffice, ~258k Einträge, UTF-8) – deutlich mehr Wörter
// als die igerman98-Basis. Englisch dient nur als Zweitprüfung, damit englische
// Wörter in Freitext/Titeln nicht als Fehler markiert werden.
// Eigener Dateiname (de-frami), damit der immutable-Cache aus vercel.json nicht
// die alte, kleinere Datei ausliefert.
const DE_AFF_URL = "/dict/de-frami.aff"
const DE_DIC_URL = "/dict/de-frami.dic"
const EN_AFF_URL = "/dict/en.aff"
const EN_DIC_URL = "/dict/en.dic"

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
  unit: string // Bezeichnung der Gruppen-Einheit: "Zeile" (Excel) | "Seite" (PDF)
}

const MAX_ERRORS = 2000

// kurze Domänen- und Standard-Abkürzungswörter sowie häufige Umgangsformen
const BUILTIN_ALLOW = new Set(
  [
    // Domäne / allgemein
    "fnf", "dsgvo", "sose", "wise", "diy", "svg", "url", "id", "idnr",
    "gmbh", "ggf", "bzw", "ca", "etc", "vs", "ok", "ngo", "eu", "usa",
    // gängige deutsche Abkürzungen
    "str", "nr", "tel", "usw", "vgl", "evtl", "inkl", "exkl", "sog", "bspw",
    "zzgl", "bzgl", "zb", "ua", "dh", "uvm", "insb", "staatl", "ggfs",
    // Umgangssprache / Interjektionen
    "nem", "nen", "ner", "hmm", "ähm", "öhm", "joa", "naja",
  ].map((w) => w.toLowerCase())
)

type Dictionaries = { de: Hunspell; en: Hunspell }

let dictsPromise: Promise<Dictionaries> | null = null

export function loadDictionary(): Promise<Dictionaries> {
  if (!dictsPromise) {
    dictsPromise = (async () => {
      const factory = await loadModule()
      const fetchBuf = (url: string) =>
        fetch(url).then((r) => r.arrayBuffer())
      const [deAff, deDic, enAff, enDic] = await Promise.all([
        fetchBuf(DE_AFF_URL),
        fetchBuf(DE_DIC_URL),
        fetchBuf(EN_AFF_URL),
        fetchBuf(EN_DIC_URL),
      ])
      const mount = (buf: ArrayBuffer, name: string) =>
        factory.mountBuffer(new Uint8Array(buf), name)
      return {
        de: factory.create(mount(deAff, "de.aff"), mount(deDic, "de.dic")),
        en: factory.create(mount(enAff, "en.aff"), mount(enDic, "en.dic")),
      }
    })()
  }
  return dictsPromise
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

// Durchsucht einen Text Wort für Wort und meldet unbekannte Wörter über onError.
// Liefert die Anzahl tatsächlich geprüfter Wörter. Gemeinsame Logik für Excel
// (je Zelle) und PDF/Freitext (je Seite).
function scanText(
  text: string,
  de: Hunspell,
  en: Hunspell,
  allow: Set<string>,
  onError: (word: string, offset: number) => boolean // false = abbrechen
): number {
  let words = 0
  for (const m of text.matchAll(WORD_RE)) {
    const word = m[0]
    const offset = m.index ?? 0
    if (isSkippableToken(word)) continue
    if (allow.has(word.toLowerCase())) continue

    // Abkürzungen / Trunkierungen nicht als Fehler werten:
    const after = text.slice(offset + word.length)
    // hängender Bindestrich (Ergänzungsstrich): "Kommunikations- und …"
    if (/^-(\s|$)/.test(after)) continue
    // Wort direkt gefolgt von "." – nur überspringen, wenn danach KEIN Satzanfang
    // steht (Ziffer/Komma/Klammer oder Kleinbuchstabe → Abkürzung).
    if (after.startsWith(".")) {
      const next = after.slice(1).replace(/^\s+/, "").charAt(0)
      if (next && (/[0-9,;)]/.test(next) || /\p{Ll}/u.test(next))) continue
    }

    words++
    // Fehler nur, wenn weder Deutsch noch Englisch das Wort kennen.
    if (de.spell(word) || en.spell(word)) continue
    if (!onError(word, offset)) break
  }
  return words
}

export async function checkWorkbook(
  parsed: ParsedWorkbook,
  ignore: Set<string> = new Set()
): Promise<SpellResult> {
  const { de, en } = await loadDictionary()

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
      s = de.suggest(word).slice(0, 6)
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
    const rowExcel = parsed.rowExcels?.[r] ?? r + 2 // echte Excel-Zeile

    for (let c = 0; c < parsed.header.length; c++) {
      const raw: CellValue = row?.[c] ?? null
      if (typeof raw !== "string") continue
      const text = raw
      if (isNonProse(text)) continue
      cellsChecked++

      const col = parsed.header[c] || `Spalte ${c + 1}`
      wordsChecked += scanText(text, de, en, allow, (word, offset) => {
        errors.push({
          rowExcel,
          name,
          column: col,
          text,
          word,
          offset,
          suggestions: suggestFor(word),
        })
        columnsWithErrors.add(col)
        if (errors.length >= MAX_ERRORS) {
          truncated = true
          return false
        }
        return true
      })
      if (truncated) break outer
    }
  }

  return {
    errors,
    cellsChecked,
    wordsChecked,
    columns: [...columnsWithErrors],
    truncated,
    unit: "Zeile",
  }
}

// Prüft Freitext seitenweise (z. B. aus einem PDF) – eine Zeichenkette je Seite.
export async function checkText(
  pages: string[],
  ignore: Set<string> = new Set()
): Promise<SpellResult> {
  const { de, en } = await loadDictionary()

  const allow = new Set<string>(BUILTIN_ALLOW)
  for (const w of CURATED_ALLOW) allow.add(w)
  for (const w of ignore) allow.add(w.toLowerCase())

  const suggestCache = new Map<string, string[]>()
  const suggestFor = (word: string): string[] => {
    const key = word.toLowerCase()
    let s = suggestCache.get(key)
    if (!s) {
      s = de.suggest(word).slice(0, 6)
      suggestCache.set(key, s)
    }
    return s
  }

  const errors: SpellError[] = []
  let cellsChecked = 0
  let wordsChecked = 0
  let truncated = false

  outer: for (let p = 0; p < pages.length; p++) {
    // URLs/E-Mails entfernen, damit sie keine Falschtreffer erzeugen.
    const text = (pages[p] || "")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/www\.\S+/gi, " ")
      .replace(/\S+@\S+\.\S+/g, " ")
    if (text.trim() === "") continue
    cellsChecked++
    const pageNo = p + 1
    wordsChecked += scanText(text, de, en, allow, (word, offset) => {
      errors.push({
        rowExcel: pageNo,
        name: null,
        column: "",
        text,
        word,
        offset,
        suggestions: suggestFor(word),
      })
      if (errors.length >= MAX_ERRORS) {
        truncated = true
        return false
      }
      return true
    })
    if (truncated) break outer
  }

  return {
    errors,
    cellsChecked,
    wordsChecked,
    columns: [],
    truncated,
    unit: "Seite",
  }
}
