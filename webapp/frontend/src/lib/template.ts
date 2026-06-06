// Befüllt ein Illustrator-SVG-Template (eine Doppelseite) mit den Daten einer
// Person + deren Chart + Foto und liefert ein fertiges, eigenständiges SVG.
//
// Felder werden über den Illustrator-Objektnamen (SVG-Attribut data-name)
// getroffen. NAME/SURNAME haben keinen Namen -> über ihren Text. Schriftgrößen
// kommen aus den <style>-Klassen der SVG; Schriftfamilie (Montserrat), Gewicht,
// Spalten-Mapping und Icons sind über eine Config einstellbar.

import type { CellValue } from "./excel"

// ------- Konfiguration (im UI über das Zahnrad-Popup einstellbar) ---------- //

export type FieldSource = "firstname" | "surname" | "column" | "static"

export type FieldSetting = {
  label: string // Anzeige im Einstellungs-Popup
  source: FieldSource // woher der Wert kommt
  column?: string // Excel-Spaltenüberschrift (nur source="column")
  weight: string // font-weight
  fontSize?: number // Schriftgröße in px (leer = aus der Vorlage übernehmen)
  prefix?: string // fester Text vor dem Wert (z. B. "Geburtsdatum: ")
  multiline?: boolean // mehrzeilig umbrechen?
  icon?: string // Icon-Schlüssel (nur Q-Felder), "" = keins
}

export type TemplateConfig = { fields: Record<string, FieldSetting> }

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  fields: {
    NAME: { label: "NAME (Vorname)", source: "firstname", weight: "400" },
    SURNAME: { label: "SURNAME (Nachname)", source: "surname", weight: "700" },
    Q1: { label: "Q1", source: "column", column: "Universität/Hochschule/Ausbildungsstätte", weight: "400", icon: "graduation" },
    Q2: { label: "Q2", source: "column", column: "Ort von Studium/Promotion/Ausbildung", weight: "400", icon: "pin" },
    Q3: { label: "Q3", source: "column", column: "Studienfach/Promotionsthema/Ausbildungsberuf", weight: "400", icon: "book" },
    Q4: { label: "Q4", source: "column", column: "Angestrebter Abschluss", weight: "400", icon: "award" },
    Q5: { label: "Q5", source: "column", column: "Geburtsjahr", weight: "400", icon: "cake" },
    Q6: { label: "Q6", source: "column", column: "Stipendiat seit (bitte wählt zunächst das Semester und dann das Kalenderjahr, in dem ihr aufgenommen wurdet)", weight: "400", icon: "calendar" },
    Q7: { label: "Q7", source: "column", column: "-", weight: "400", icon: "star" },
    T1: { label: "T1", source: "column", column: "Beschreibe dein Jahr 2025 in drei Worten", weight: "400", multiline: true },
    T2: { label: "T2", source: "column", column: "Welche Werte sind dir im Leben unverhandelbar?", weight: "400", multiline: true },
    T3: { label: "T3", source: "column", column: "Mit welcher Person (lebendig oder Tod) würdest du gerne zu Abendessen?", weight: "400", multiline: true },
    T4: { label: "T4", source: "column", column: "Welche politische Idee würdest du direkt umsetzen, wenn du könntest?", weight: "400", multiline: true },
    T5: { label: "T5", source: "column", column: "Welche völlig nutzlose Fähigkeit beherrscht du perfekt?", weight: "400", multiline: true },
    T6: { label: "T6", source: "column", column: "Was heißt liberal sein im Hier und Jetzt?", weight: "400", multiline: true },
    H1: { label: "H1 (Frage, statisch)", source: "static", weight: "600" },
    H2: { label: "H2 (Frage, statisch)", source: "static", weight: "600" },
    H3: { label: "H3 (Frage, statisch)", source: "static", weight: "600" },
    H4: { label: "H4 (Frage, statisch)", source: "static", weight: "600" },
    H5: { label: "H5 (Frage, statisch)", source: "static", weight: "600" },
    H6: { label: "H6 (Frage, statisch)", source: "static", weight: "700" },
  },
}

// Distinkte Gewichte (zum Einbetten als @font-face nötig).
export function configWeights(cfg: TemplateConfig): string[] {
  const s = new Set<string>(["400"])
  for (const f of Object.values(cfg.fields)) s.add(f.weight)
  return [...s]
}

// Gespeicherte Config mit den Defaults zusammenführen (Schema-robust).
export function mergeConfig(stored: Partial<TemplateConfig> | null): TemplateConfig {
  const out: TemplateConfig = { fields: {} }
  for (const [k, def] of Object.entries(DEFAULT_TEMPLATE_CONFIG.fields)) {
    out.fields[k] = { ...def, ...(stored?.fields?.[k] ?? {}) }
  }
  return out
}

// ------- Icons (Lucide, 24×24, stroke), per Schlüssel wählbar -------------- //

export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "", label: "—" },
  { key: "graduation", label: "Abschlusshut" },
  { key: "pin", label: "Ort" },
  { key: "book", label: "Buch" },
  { key: "award", label: "Auszeichnung" },
  { key: "cake", label: "Geburtstag" },
  { key: "calendar", label: "Kalender" },
  { key: "star", label: "Stern" },
]

const ICON_COLOR = "#231f20"
const ICONS: Record<string, Array<{ tag: string; attrs: Record<string, string> }>> = {
  graduation: [
    { tag: "path", attrs: { d: "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" } },
    { tag: "path", attrs: { d: "M22 10v6" } },
    { tag: "path", attrs: { d: "M6 12.5V16a6 3 0 0 0 12 0v-3.5" } },
  ],
  pin: [
    { tag: "path", attrs: { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" } },
    { tag: "circle", attrs: { cx: "12", cy: "10", r: "3" } },
  ],
  book: [
    { tag: "path", attrs: { d: "M12 7v14" } },
    { tag: "path", attrs: { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" } },
  ],
  award: [
    { tag: "path", attrs: { d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" } },
    { tag: "circle", attrs: { cx: "12", cy: "8", r: "6" } },
  ],
  cake: [
    { tag: "path", attrs: { d: "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" } },
    { tag: "path", attrs: { d: "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" } },
    { tag: "path", attrs: { d: "M2 21h20" } },
    { tag: "path", attrs: { d: "M7 8v3M12 8v3M17 8v3" } },
    { tag: "path", attrs: { d: "M7 4h.01M12 4h.01M17 4h.01" } },
  ],
  calendar: [
    { tag: "path", attrs: { d: "M8 2v4M16 2v4" } },
    { tag: "rect", attrs: { width: "18", height: "18", x: "3", y: "4", rx: "2" } },
    { tag: "path", attrs: { d: "M3 10h18" } },
  ],
  star: [
    { tag: "path", attrs: { d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" } },
  ],
}

const SVGNS = "http://www.w3.org/2000/svg"

function addIcon(
  doc: Document,
  svg: Element,
  iconKey: string,
  x: number,
  centerY: number,
  size: number
) {
  const defs = ICONS[iconKey]
  if (!defs) return
  const g = doc.createElementNS(SVGNS, "g")
  g.setAttribute("transform", `translate(${x} ${centerY - size / 2}) scale(${size / 24})`)
  g.setAttribute("fill", "none")
  g.setAttribute("stroke", ICON_COLOR)
  g.setAttribute("stroke-width", "2")
  g.setAttribute("stroke-linecap", "round")
  g.setAttribute("stroke-linejoin", "round")
  for (const d of defs) {
    const el = doc.createElementNS(SVGNS, d.tag)
    for (const [k, v] of Object.entries(d.attrs)) el.setAttribute(k, v)
    g.appendChild(el)
  }
  svg.appendChild(g)
}

// ------- Hilfsfunktionen --------------------------------------------------- //

function cellStr(v: CellValue | undefined): string {
  if (v == null) return ""
  return String(v).trim()
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "")
}

function findColIndex(header: string[], target: string): number {
  if (target === "-") return header.findIndex((h) => (h ?? "").trim() === "-")
  const t = norm(target)
  let idx = header.findIndex((h) => norm(String(h ?? "")) === t)
  if (idx >= 0) return idx
  idx = header.findIndex((h) => {
    const n = norm(String(h ?? ""))
    return n.length > 2 && (n.includes(t) || t.includes(n))
  })
  return idx
}

// --- Textmessung per Canvas (für Umbruch/Autofit) ------------------------- //
let ctx: CanvasRenderingContext2D | null = null
function measure(text: string, size: number, weight: string): number {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return text.length * size * 0.55
  ctx.font = `${weight} ${size}px 'Montserrat', sans-serif`
  return ctx.measureText(text).width
}

function wrap(text: string, maxWidth: number, size: number, weight: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const test = cur ? cur + " " + w : w
    if (!cur || measure(test, size, weight) <= maxWidth) cur = test
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [""]
}

function parseClassSizes(root: Element): Record<string, number> {
  const map: Record<string, number> = {}
  const styles = root.getElementsByTagName("style")
  for (let i = 0; i < styles.length; i++) {
    const txt = styles[i].textContent || ""
    const re = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(txt))) {
      const fs = /font-size\s*:\s*([\d.]+)px/.exec(m[2])
      if (fs) map[m[1]] = parseFloat(fs[1])
    }
  }
  return map
}

function fontSizeOf(el: Element, sizes: Record<string, number>): number {
  const inline = el.getAttribute("font-size")
  if (inline) return parseFloat(inline)
  const cls = (el.getAttribute("class") || "").trim().split(/\s+/)[0]
  return sizes[cls] ?? 11
}

function firstTspanXY(textEl: Element): { x: string; y: string } {
  const t = textEl.getElementsByTagName("tspan")[0]
  return { x: t?.getAttribute("x") ?? "0", y: t?.getAttribute("y") ?? "0" }
}

function lineHeightRatio(textEl: Element, size: number): number {
  const t = textEl.getElementsByTagName("tspan")
  if (t.length >= 2) {
    const d =
      parseFloat(t[1].getAttribute("y") || "0") -
      parseFloat(t[0].getAttribute("y") || "0")
    if (d > 0) return d / size
  }
  return 1.2
}

function dummyWidth(textEl: Element, size: number, weight: string): number {
  const t = textEl.getElementsByTagName("tspan")
  let max = 0
  for (let i = 0; i < t.length; i++)
    max = Math.max(max, measure(t[i].textContent || "", size, weight))
  return Math.max(80, max)
}

function clearChildren(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

function setSingleLine(doc: Document, textEl: Element, value: string) {
  const { x, y } = firstTspanXY(textEl)
  clearChildren(textEl)
  const tspan = doc.createElementNS(SVGNS, "tspan")
  tspan.setAttribute("x", x)
  tspan.setAttribute("y", y)
  tspan.textContent = value
  textEl.appendChild(tspan)
}

function setMultiLine(
  doc: Document,
  textEl: Element,
  value: string,
  sizes: Record<string, number>,
  weight: string
) {
  const baseSize = fontSizeOf(textEl, sizes)
  const lh = lineHeightRatio(textEl, baseSize)
  const maxW = dummyWidth(textEl, baseSize, weight)
  const budget = Math.max(1, textEl.getElementsByTagName("tspan").length)
  const { x, y } = firstTspanXY(textEl)
  const y0 = parseFloat(y) || 0

  let size = baseSize
  let lines = wrap(value, maxW, size, weight)
  while (lines.length > budget && size > 7) {
    size = size * 0.92
    lines = wrap(value, maxW, size, weight)
  }
  if (size < baseSize) textEl.setAttribute("font-size", String(size.toFixed(2)))

  clearChildren(textEl)
  const lineH = size * lh
  lines.forEach((line, i) => {
    const tspan = doc.createElementNS(SVGNS, "tspan")
    tspan.setAttribute("x", x)
    tspan.setAttribute("y", String(y0 + i * lineH))
    tspan.textContent = line
    textEl.appendChild(tspan)
  })
}

function translateOf(el: Element): { x: number; y: number } | null {
  const m = (el.getAttribute("transform") || "").match(
    /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/
  )
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
}

function setTranslateX(el: Element, x: number) {
  const tr = el.getAttribute("transform") || ""
  const m = tr.match(/translate\(\s*([-\d.]+)([\s,]+)([-\d.]+)\s*\)/)
  if (!m) return
  el.setAttribute("transform", tr.replace(m[0], `translate(${x}${m[2]}${m[3]})`))
}

function shiftTranslateY(el: Element, delta: number) {
  const tr = el.getAttribute("transform") || ""
  const m = tr.match(/translate\(\s*([-\d.]+)([\s,]+)([-\d.]+)\s*\)/)
  if (!m) return
  const ny = parseFloat(m[3]) + delta
  el.setAttribute("transform", tr.replace(m[0], `translate(${m[1]}${m[2]}${ny})`))
}

// Setzt das Schriftgewicht als Inline-Style auf das <text>-Element UND jedes
// <tspan> darin. Wichtig: Die globale Regel `tspan{font-weight:400}` zielt direkt
// auf jedes tspan und schlägt damit ein nur am Eltern-<text> vererbtes Gewicht.
// Ein Inline-Style am tspan selbst gewinnt dagegen (kein !important im Sheet).
function setWeight(el: Element, weight: string) {
  el.setAttribute("style", `font-weight:${weight}`)
  const tspans = el.getElementsByTagName("tspan")
  for (let i = 0; i < tspans.length; i++)
    tspans[i].setAttribute("style", `font-weight:${weight}`)
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// Sichtbares Rechteck (in Elternkoordinaten) eines <image>-Platzhalters: x/y/
// width/height kombiniert mit translate()+scale() aus dem transform.
function imageFrameRect(el: Element): { x: number; y: number; w: number; h: number } {
  const w0 = parseFloat(el.getAttribute("width") || "0")
  const h0 = parseFloat(el.getAttribute("height") || "0")
  const x0 = parseFloat(el.getAttribute("x") || "0")
  const y0 = parseFloat(el.getAttribute("y") || "0")
  const tr = el.getAttribute("transform") || ""
  const t = tr.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/)
  const s = tr.match(/scale\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?/)
  const tx = t ? parseFloat(t[1]) : 0
  const ty = t ? parseFloat(t[2]) : 0
  const sx = s ? parseFloat(s[1]) : 1
  const sy = s ? (s[2] !== undefined ? parseFloat(s[2]) : parseFloat(s[1])) : 1
  return { x: tx + x0 * sx, y: ty + y0 * sy, w: w0 * sx, h: h0 * sy }
}

function findTextByContent(svg: Element, target: string): Element | null {
  const texts = svg.getElementsByTagName("text")
  for (let i = 0; i < texts.length; i++) {
    if ((texts[i].textContent || "").trim().toUpperCase() === target.toUpperCase())
      return texts[i]
  }
  return null
}

// ------- Hauptfunktion ----------------------------------------------------- //

export type FillOptions = {
  templateSvg: string
  header: string[]
  row: CellValue[] | undefined
  name: string
  chartSvg: string
  photoDataUrl?: string | null
  // Natürliche Bildmaße + Fokuspunkt (0..1) für frei wählbaren Bildausschnitt
  // beim Fill. Ohne diese Angaben: zentriertes Cover (Fallback).
  photoSize?: { w: number; h: number }
  photoCrop?: { x: number; y: number }
  fontFaceCss: string
  config: TemplateConfig
}

const ICON_SIZE = 13
const ICON_GAP = 6
// Einrückung des Q-Blocks (Icon + Text) rechts von der Foto-Linkskante.
const Q_INDENT = 12

export function fillTemplate(opts: FillOptions): string {
  const {
    templateSvg,
    header,
    row,
    name,
    chartSvg,
    photoDataUrl,
    photoSize,
    photoCrop,
    fontFaceCss,
    config,
  } = opts
  const doc = new DOMParser().parseFromString(templateSvg, "image/svg+xml")
  const svg = doc.documentElement
  const sizes = parseClassSizes(svg)

  // 1) Montserrat einbetten + Schriftfamilie global setzen (Gewicht je Feld unten).
  let defs = svg.getElementsByTagName("defs")[0]
  if (!defs) {
    defs = doc.createElementNS(SVGNS, "defs")
    svg.insertBefore(defs, svg.firstChild)
  }
  const style = doc.createElementNS(SVGNS, "style")
  style.textContent =
    fontFaceCss +
    `\ntext,tspan{font-family:'Montserrat',Arial,sans-serif;font-weight:400;}`
  defs.appendChild(style)

  // Foto-Linkskante (für Q-Ausrichtung) vor dem evtl. Entfernen lesen.
  const imageEl = svg.querySelector('[data-name="Image"]')
  const imageLeftX = imageEl ? translateOf(imageEl)?.x ?? null : null

  // Namen aufteilen.
  const parts = name.trim().split(/\s+/)
  const surname = parts.length > 1 ? parts[parts.length - 1] : ""
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : name.trim()

  // H/T-Block-Metriken VOR dem Füllen erfassen (für gleichmäßige Abstände).
  type Pair = {
    hEl: Element
    tEl: Element
    hx: number
    hy: number
    ty: number
    dummyLines: number // Zeilenzahl im Template (für den Original-Abstand)
    tlh0: number // Zeilenhöhe im Template
  }
  const pairs: Pair[] = []
  for (let k = 1; k <= 12; k++) {
    const hEl = svg.querySelector(`[data-name="H${k}"]`)
    const tEl = svg.querySelector(`[data-name="T${k}"]`)
    if (!hEl || !tEl) continue
    const ht = translateOf(hEl)
    const tt = translateOf(tEl)
    if (!ht || !tt) continue
    const tsize = fontSizeOf(tEl, sizes)
    pairs.push({
      hEl,
      tEl,
      hx: ht.x,
      hy: ht.y,
      ty: tt.y,
      dummyLines: tEl.getElementsByTagName("tspan").length,
      tlh0: lineHeightRatio(tEl, tsize) * tsize,
    })
  }

  // 2) Felder gemäß Config füllen.
  for (const [slug, f] of Object.entries(config.fields)) {
    let el: Element | null
    let value: string | null

    if (f.source === "firstname" || f.source === "surname") {
      el = findTextByContent(svg, slug) // NAME / SURNAME über Text
      value = f.source === "firstname" ? given : surname
    } else {
      el = svg.querySelector(`[data-name="${slug}"]`)
      if (f.source === "column") {
        const idx = f.column ? findColIndex(header, f.column) : -1
        value = idx >= 0 ? cellStr(row?.[idx]) : ""
      } else {
        value = null // static: Text unverändert lassen
      }
    }
    if (!el) continue

    // Schriftgröße-Override (vor dem Setzen, damit Umbruch + Zeilenhöhe stimmen).
    if (f.fontSize && f.fontSize > 0)
      el.setAttribute("font-size", String(f.fontSize))

    if (value !== null) {
      const text = (f.prefix ?? "") + value
      if (f.multiline) setMultiLine(doc, el, text, sizes, f.weight)
      else setSingleLine(doc, el, text)
    }

    // Gewicht als Inline-Style auf <text> + alle <tspan> (schlägt das Sheet).
    setWeight(el, f.weight)

    // Q-Felder: Icon + Text, Block ab Foto-Linkskante + Einrückung nach rechts.
    if (slug.startsWith("Q") && imageLeftX != null) {
      const ty = translateOf(el)?.y ?? 0
      const fs = fontSizeOf(el, sizes)
      const hasIcon = !!f.icon && f.icon in ICONS
      const iconX = imageLeftX + Q_INDENT
      if (hasIcon) addIcon(doc, svg, f.icon as string, iconX, ty - fs * 0.32, ICON_SIZE)
      setTranslateX(el, iconX + (hasIcon ? ICON_SIZE + ICON_GAP : 0))
    }
  }

  // 2b) Gleichmäßige Abstände zwischen den (H+T)-Blöcken je Spalte.
  // Der Weißraum zwischen letzter T-Zeile und nächstem H wird konstant gemacht
  // (= Mittel der im Template vorgesehenen Abstände). Erster Block bleibt fix.
  const groups = new Map<number, Pair[]>()
  for (const p of pairs) {
    const key = Math.round(p.hx)
    const arr = groups.get(key)
    if (arr) arr.push(p)
    else groups.set(key, [p])
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => a.hy - b.hy)
    // Ziel-Gap = Mittel der ursprünglich vorgesehenen Abstände.
    let sum = 0
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      sum += group[i].hy - (prev.ty + (prev.dummyLines - 1) * prev.tlh0)
    }
    const gap = sum / (group.length - 1)
    const tLines = (p: Pair) => p.tEl.getElementsByTagName("tspan").length
    const tLineH = (p: Pair) => {
      const s = fontSizeOf(p.tEl, sizes)
      return lineHeightRatio(p.tEl, s) * s
    }
    // Block 0 bleibt; Folgeblöcke rigide verschieben -> konstanter Gap.
    let cursor = group[0].ty + (tLines(group[0]) - 1) * tLineH(group[0])
    for (let i = 1; i < group.length; i++) {
      const p = group[i]
      const delta = cursor + gap - p.hy
      shiftTranslateY(p.hEl, delta)
      shiftTranslateY(p.tEl, delta)
      cursor = p.ty + delta + (tLines(p) - 1) * tLineH(p)
    }
  }

  // 3) Chart in die "Graph"-Box einpassen.
  const graph = svg.querySelector('[data-name="Graph"]')
  if (graph) {
    const gx = parseFloat(graph.getAttribute("x") || "0")
    const gy = parseFloat(graph.getAttribute("y") || "0")
    const gw = parseFloat(graph.getAttribute("width") || "0")
    const gh = parseFloat(graph.getAttribute("height") || "0")
    const chartDoc = new DOMParser().parseFromString(chartSvg, "image/svg+xml")
    const imported = doc.importNode(chartDoc.documentElement, true) as Element
    imported.setAttribute("x", String(gx))
    imported.setAttribute("y", String(gy))
    imported.setAttribute("width", String(gw))
    imported.setAttribute("height", String(gh))
    imported.setAttribute("preserveAspectRatio", "xMidYMid meet")
    imported.removeAttribute("style")
    graph.parentNode?.insertBefore(imported, graph)
    graph.parentNode?.removeChild(graph)
  }

  // 4) Foto in "Image" (cover/Fill) – sonst Platzhalter entfernen.
  const image = svg.querySelector('[data-name="Image"]')
  if (image) {
    if (!photoDataUrl) {
      image.parentNode?.removeChild(image)
    } else if (photoSize && photoSize.w > 0 && photoSize.h > 0) {
      // Frei wählbarer Bildausschnitt: verschachteltes <svg> als Rahmen (clippt
      // automatisch), Bild exakt wie CSS object-fit:cover + object-position.
      const fr = imageFrameRect(image)
      const cx = clamp01(photoCrop?.x ?? 0.5)
      const cy = clamp01(photoCrop?.y ?? 0.5)
      const cover = Math.max(fr.w / photoSize.w, fr.h / photoSize.h)
      const sw = photoSize.w * cover
      const sh = photoSize.h * cover
      const ns = doc.createElementNS(SVGNS, "svg")
      ns.setAttribute("x", String(fr.x))
      ns.setAttribute("y", String(fr.y))
      ns.setAttribute("width", String(fr.w))
      ns.setAttribute("height", String(fr.h))
      const im = doc.createElementNS(SVGNS, "image")
      im.setAttribute("x", String(cx * (fr.w - sw)))
      im.setAttribute("y", String(cy * (fr.h - sh)))
      im.setAttribute("width", String(sw))
      im.setAttribute("height", String(sh))
      im.setAttribute("preserveAspectRatio", "none")
      im.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", photoDataUrl)
      im.setAttribute("href", photoDataUrl)
      ns.appendChild(im)
      image.parentNode?.replaceChild(ns, image)
    } else {
      // Fallback ohne Maße: zentriertes Cover.
      image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", photoDataUrl)
      image.setAttribute("href", photoDataUrl)
      image.setAttribute("preserveAspectRatio", "xMidYMid slice")
    }
  }

  return new XMLSerializer().serializeToString(doc)
}

// Liest die in der Vorlage tatsächlich verwendete Schriftgröße je Feld (aus den
// CSS-Klassen). Dient als Vorbelegung/Platzhalter im Einstellungs-Popup.
export function templateFontSizes(templateSvg: string): Record<string, number> {
  const doc = new DOMParser().parseFromString(templateSvg, "image/svg+xml")
  const svg = doc.documentElement
  const sizes = parseClassSizes(svg)
  const out: Record<string, number> = {}
  for (const [slug, f] of Object.entries(DEFAULT_TEMPLATE_CONFIG.fields)) {
    const el =
      f.source === "firstname" || f.source === "surname"
        ? findTextByContent(svg, slug)
        : svg.querySelector(`[data-name="${slug}"]`)
    if (el) out[slug] = Math.round(fontSizeOf(el, sizes) * 100) / 100
  }
  return out
}

// Seitenverhältnis (Breite/Höhe) des Foto-Rahmens – für die Vorschau-/Cropper-Box.
export function templateImageAspect(templateSvg: string): number {
  const doc = new DOMParser().parseFromString(templateSvg, "image/svg+xml")
  const el = doc.documentElement.querySelector('[data-name="Image"]')
  if (!el) return 1
  const w = parseFloat(el.getAttribute("width") || "1")
  const h = parseFloat(el.getAttribute("height") || "1")
  return w > 0 && h > 0 ? w / h : 1
}

// Baut eine CSV der zusammengeführten Daten (eine Zeile pro Person, Spalten =
// datengetriebene Felder). Trennzeichen ";" + UTF-8-BOM für Excel/Umlaute.
export function buildMergeCsv(opts: {
  people: { name: string; row: CellValue[] | undefined }[]
  header: string[]
  config: TemplateConfig
}): string {
  const { people, header, config } = opts
  const fields = Object.entries(config.fields).filter(
    ([, f]) => f.source !== "static"
  )
  const headers = [
    "Name",
    ...fields.map(([slug, f]) =>
      f.source === "firstname"
        ? "Vorname"
        : f.source === "surname"
          ? "Nachname"
          : f.column || slug
    ),
  ]
  const rows = people.map(({ name, row }) => {
    const parts = name.trim().split(/\s+/)
    const surname = parts.length > 1 ? parts[parts.length - 1] : ""
    const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : name.trim()
    const vals = fields.map(([, f]) => {
      if (f.source === "firstname") return given
      if (f.source === "surname") return surname
      const idx = f.column ? findColIndex(header, f.column) : -1
      return idx >= 0 ? cellStr(row?.[idx]) : ""
    })
    return [name, ...vals]
  })
  const esc = (s: string) => {
    const v = String(s ?? "")
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const lines = [headers, ...rows].map((r) => r.map(esc).join(";"))
  return "﻿" + lines.join("\r\n")
}
