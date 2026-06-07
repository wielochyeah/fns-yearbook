// Erzeugt eine Karte (beliebige Regionen: Bundesländer oder Länder der Welt) als
// eigenständiges SVG mit einer Zahl ODER Prozentangabe je Region. Alle Farben,
// Rahmen, Schrift und Label-Positionen sind über die Optionen einstellbar.

import { GERMANY_STATES, MAP_VIEWBOX } from "./germanyMap"

// Eine Region (Bundesland/Land): SVG-Pfad + Flächen-Zentroid (Label-Default).
export type RegionGeo = {
  id: string
  name: string
  path: string
  cx: number
  cy: number
}

export type MapValueMode = "count" | "percent"

export type MapStyle = {
  valueMode: MapValueMode
  decimals: number // Nachkommastellen bei Prozent
  hideZero: boolean // Beschriftung bei 0 ausblenden
  mapColor: string // Standard-Füllfarbe aller Länder
  stateColors: Record<string, string> // Füllfarbe je Land (Override, höchste Prio)
  // Wertbasierte Farbabstufung (Choropleth): Farbe je nach Größe der Zahl
  // zwischen gradientLow (Wert 0) und gradientHigh (Maximalwert) interpoliert.
  gradient: boolean
  gradientLow: string
  gradientHigh: string
  borderColor: string // Rahmen zwischen den Ländern
  borderWidth: number
  outlineColor: string // Außenrand der Karte
  outlineWidth: number // 0 = aus
  transparent: boolean
  bgColor: string
  padding: number // Rand um die Karte
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontColor: string
  labelOffsets: Record<string, { dx: number; dy: number }> // Verschiebung je Label
  // --- Ansicht: Karte oder Balkendiagramm ---
  chartType: "map" | "bars"
  barOrientation: "vertical" | "horizontal"
  barTopN: number // 0 = alle, sonst nur die Top-N nach Wert
  barSort: "valueDesc" | "valueAsc" | "name"
  showValueAxis: boolean // Werteachse (inkl. Beschriftung)
  showCategoryAxis: boolean // Kategorieachse (Namen)
  showGrid: boolean // Gitterlinien
  showValues: boolean // Werte an den Balken
  axisColor: string
  gridColor: string
  fontFaceCss?: string // optionales @font-face (eingebettetes Montserrat)
}

export const DEFAULT_MAP_STYLE: MapStyle = {
  valueMode: "count",
  decimals: 0,
  hideZero: false,
  mapColor: "#EBEBEB",
  stateColors: {},
  gradient: false,
  gradientLow: "#E6EEF6",
  gradientHigh: "#1C5D99",
  borderColor: "#FFFFFF",
  borderWidth: 1.2,
  outlineColor: "#231F20",
  outlineWidth: 0,
  transparent: true,
  bgColor: "#FFFFFF",
  padding: 16,
  fontFamily: "'Montserrat', Arial, Helvetica, sans-serif",
  fontSize: 18,
  fontWeight: "600",
  fontColor: "#231F20",
  // Brandenburg-Label aus der Berlin-Enklave herausschieben (Stadtstaat).
  labelOffsets: { "DE-BB": { dx: 30, dy: 55 } },
  chartType: "map",
  barOrientation: "vertical",
  barTopN: 0,
  barSort: "valueDesc",
  showValueAxis: true,
  showCategoryAxis: true,
  showGrid: false,
  showValues: true,
  axisColor: "#231F20",
  gridColor: "#E5E7EB",
}

function hexToRgb(h: string): [number, number, number] | null {
  let s = (h || "").trim().replace(/^#/, "")
  if (s.length === 3) s = s.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ]
}

// Lineare Interpolation zweier Hex-Farben (t in [0,1]).
function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return cb ? b : a
  const u = Math.max(0, Math.min(1, t))
  const ch = (i: number) =>
    Math.round(ca[i] + (cb[i] - ca[i]) * u)
      .toString(16)
      .padStart(2, "0")
  return `#${ch(0)}${ch(1)}${ch(2)}`
}

// Füllfarbe einer Region: expliziter Override > Farbabstufung > Standardfarbe.
function regionFill(
  id: string,
  counts: Record<string, number>,
  s: MapStyle,
  max: number
): string {
  if (s.stateColors[id]) return s.stateColors[id]
  if (s.gradient) {
    const v = Number(counts[id]) || 0
    return lerpColor(s.gradientLow, s.gradientHigh, max > 0 ? v / max : 0)
  }
  return s.mapColor
}

const maxCount = (counts: Record<string, number>) =>
  Object.values(counts).reduce((m, n) => Math.max(m, Number(n) || 0), 0)

const f1 = (n: number) => Math.round(n * 10) / 10
const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

// Beschriftungstext je Land (Zahl oder Prozent), "" wenn ausgeblendet.
function labelText(
  counts: Record<string, number>,
  id: string,
  s: MapStyle
): string {
  const count = Number(counts[id]) || 0
  if (s.valueMode === "percent") {
    const total = Object.values(counts).reduce((a, n) => a + (Number(n) || 0), 0)
    const pct = total ? (count / total) * 100 : 0
    if (s.hideZero && pct === 0) return ""
    return `${pct.toFixed(Math.max(0, s.decimals))}%`
  }
  if (s.hideZero && count === 0) return ""
  return String(count)
}

// Generischer Karten-Builder für beliebige Regionen + viewBox.
export function buildMapSvg(
  regions: RegionGeo[],
  viewBox: { w: number; h: number },
  counts: Record<string, number>,
  s: MapStyle
): string {
  // Genügend Rand, damit der Außenrand nicht abgeschnitten wird.
  const pad = Math.max(0, s.padding) + (s.outlineWidth > 0 ? s.outlineWidth : 0)
  const W = viewBox.w + 2 * pad
  const H = viewBox.h + 2 * pad

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(W)}" height="${f1(
      H
    )}" viewBox="0 0 ${f1(W)} ${f1(H)}">`
  )
  if (s.fontFaceCss) {
    parts.push(`<defs><style type="text/css">${s.fontFaceCss}</style></defs>`)
  }
  if (!s.transparent) {
    parts.push(
      `<rect x="0" y="0" width="${f1(W)}" height="${f1(H)}" fill="${s.bgColor}"/>`
    )
  }

  parts.push(`<g transform="translate(${f1(pad)} ${f1(pad)})">`)

  // Außenrand: inflierte Silhouette unter den Füllungen (die Innenkanten werden
  // von den Länderfüllungen verdeckt, außen bleibt ein Rand der Breite outlineWidth).
  if (s.outlineWidth > 0) {
    parts.push(`<g fill="${s.outlineColor}" stroke="${s.outlineColor}" stroke-width="${f1(
      s.outlineWidth * 2
    )}" stroke-linejoin="round">`)
    for (const st of regions) parts.push(`<path d="${st.path}"/>`)
    parts.push(`</g>`)
  }

  // Länderflächen mit Rahmen zwischen den Ländern.
  parts.push(
    `<g stroke="${s.borderColor}" stroke-width="${f1(
      s.borderWidth
    )}" stroke-linejoin="round">`
  )
  const max = maxCount(counts)
  for (const st of regions) {
    parts.push(
      `<path d="${st.path}" fill="${regionFill(st.id, counts, s, max)}"/>`
    )
  }
  parts.push(`</g>`)

  // Beschriftungen (Zahl/Prozent) je Land.
  for (const st of regions) {
    const txt = labelText(counts, st.id, s)
    if (!txt) continue
    const off = s.labelOffsets[st.id] || { dx: 0, dy: 0 }
    const x = f1(st.cx + (off.dx || 0))
    const y = f1(st.cy + (off.dy || 0))
    parts.push(
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="font-family:${
        s.fontFamily
      };font-size:${s.fontSize}px;font-weight:${s.fontWeight};fill:${
        s.fontColor
      }">${xmlEscape(txt)}</text>`
    )
  }

  parts.push(`</g>`)
  parts.push(`</svg>`)
  return parts.join("\n")
}

// Bequemer Wrapper für die Deutschland-Karte.
export function buildGermanyMapSvg(
  counts: Record<string, number>,
  s: MapStyle
): string {
  return buildMapSvg(GERMANY_STATES, MAP_VIEWBOX, counts, s)
}

// ---- Balkendiagramm ------------------------------------------------------- //

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const f = v / base
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * base
}

function axisTicks(max: number, integer: boolean): number[] {
  const raw = (max || 1) / 5
  const exp = Math.floor(Math.log10(raw || 1))
  const base = Math.pow(10, exp)
  const f = (raw || 1) / base
  let step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * base
  if (integer) step = Math.max(1, Math.round(step))
  const ticks: number[] = []
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(t)
  return ticks
}

// Erzeugt ein Balkendiagramm (eigenständiges SVG) aus denselben Daten/Optionen
// wie die Karte. Balkenfarbe = mapColor bzw. stateColors-Override je Region.
export function buildBarChartSvg(
  regions: RegionGeo[],
  counts: Record<string, number>,
  s: MapStyle
): string {
  const total = Object.values(counts).reduce((a, n) => a + (Number(n) || 0), 0)
  const disp = (count: number) =>
    s.valueMode === "percent" ? (total ? (count / total) * 100 : 0) : count
  const fmtVal = (count: number) =>
    s.valueMode === "percent"
      ? `${disp(count).toFixed(Math.max(0, s.decimals))}%`
      : String(count)
  const fmtTick = (t: number) =>
    s.valueMode === "percent"
      ? `${t.toFixed(Math.max(0, s.decimals))}%`
      : String(Math.round(t))

  let data = regions.map((r) => ({
    id: r.id,
    name: r.name,
    count: Number(counts[r.id]) || 0,
  }))
  if (s.hideZero) data = data.filter((d) => d.count > 0)
  if (s.barSort === "valueAsc") data.sort((a, b) => a.count - b.count)
  else if (s.barSort === "name")
    data.sort((a, b) => a.name.localeCompare(b.name, "de"))
  else data.sort((a, b) => b.count - a.count)
  if (s.barTopN > 0) data = data.slice(0, s.barTopN)

  const fs = s.fontSize
  const measure = (t: string) => t.length * fs * 0.58
  const fontStyle = `font-family:${s.fontFamily};font-size:${fs}px;font-weight:${s.fontWeight};fill:${s.fontColor}`
  const pad = Math.max(0, s.padding)
  const max = maxCount(counts)
  const fillOf = (id: string) => regionFill(id, counts, s, max)

  const parts: string[] = []
  const open = (w: number, h: number) => {
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(w)}" height="${f1(
        h
      )}" viewBox="0 0 ${f1(w)} ${f1(h)}">`
    )
    if (s.fontFaceCss)
      parts.push(`<defs><style type="text/css">${s.fontFaceCss}</style></defs>`)
    if (!s.transparent)
      parts.push(
        `<rect x="0" y="0" width="${f1(w)}" height="${f1(h)}" fill="${s.bgColor}"/>`
      )
  }

  if (data.length === 0) {
    open(220, 80)
    parts.push(
      `<text x="110" y="44" text-anchor="middle" style="${fontStyle}">Keine Daten</text>`
    )
    parts.push(`</svg>`)
    return parts.join("\n")
  }

  const maxVal = data.reduce((m, d) => Math.max(m, disp(d.count)), 0)
  const axisMax = niceMax(maxVal)
  const ticks = axisTicks(axisMax, s.valueMode === "count")
  const scale = (v: number) => (axisMax > 0 ? (v / axisMax) * 360 : 0)
  const thick = Math.max(12, fs * 1.4)
  const gap = thick * 0.6
  const step = thick + gap
  const n = data.length
  const longest = Math.max(...data.map((d) => measure(d.name)))
  const widestVal = Math.max(...data.map((d) => measure(fmtVal(d.count))))

  if (s.barOrientation === "vertical") {
    const valW = s.showValueAxis
      ? Math.max(...ticks.map((t) => measure(fmtTick(t)))) + 10
      : 4
    // Linker Rand auch für den Überhang der -45°-gedrehten Namen reservieren.
    const rotOver = s.showCategoryAxis
      ? longest * Math.SQRT1_2 - (gap / 2 + thick / 2) + 8
      : 0
    const mLeft = Math.max(valW, rotOver, 4)
    const mTop = (s.showValues ? fs * 1.4 : 4) + 4
    const mBottom = s.showCategoryAxis ? longest * Math.SQRT1_2 + fs + 8 : 8
    const plotW = n * step
    const plotH = 360
    open(pad * 2 + mLeft + plotW + 10, pad * 2 + mTop + plotH + mBottom)
    parts.push(`<g transform="translate(${f1(pad + mLeft)} ${f1(pad + mTop)})">`)
    for (const t of ticks) {
      const y = plotH - scale(t)
      if (s.showGrid)
        parts.push(
          `<line x1="0" y1="${f1(y)}" x2="${f1(plotW)}" y2="${f1(
            y
          )}" stroke="${s.gridColor}" stroke-width="1"/>`
        )
      if (s.showValueAxis)
        parts.push(
          `<text x="-8" y="${f1(
            y
          )}" text-anchor="end" dominant-baseline="central" style="${fontStyle}">${xmlEscape(
            fmtTick(t)
          )}</text>`
        )
    }
    if (s.showValueAxis)
      parts.push(
        `<line x1="0" y1="0" x2="0" y2="${f1(plotH)}" stroke="${s.axisColor}" stroke-width="1.2"/>`
      )
    if (s.showCategoryAxis)
      parts.push(
        `<line x1="0" y1="${f1(plotH)}" x2="${f1(plotW)}" y2="${f1(
          plotH
        )}" stroke="${s.axisColor}" stroke-width="1.2"/>`
      )
    data.forEach((d, i) => {
      const x = i * step + gap / 2
      const bh = scale(disp(d.count))
      const y = plotH - bh
      parts.push(
        `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(thick)}" height="${f1(
          bh
        )}" fill="${fillOf(d.id)}"/>`
      )
      if (s.showValues)
        parts.push(
          `<text x="${f1(x + thick / 2)}" y="${f1(
            y - fs * 0.4
          )}" text-anchor="middle" style="${fontStyle}">${xmlEscape(
            fmtVal(d.count)
          )}</text>`
        )
      if (s.showCategoryAxis) {
        const cx = x + thick / 2
        const ly = plotH + fs * 0.9
        parts.push(
          `<text x="${f1(cx)}" y="${f1(
            ly
          )}" text-anchor="end" transform="rotate(-45 ${f1(cx)} ${f1(
            ly
          )})" style="${fontStyle}">${xmlEscape(d.name)}</text>`
        )
      }
    })
    parts.push(`</g>`)
  } else {
    const mLeft = s.showCategoryAxis ? longest + 10 : 4
    const mRight = s.showValues ? widestVal + 12 : 8
    const mTop = 4
    const mBottom = s.showValueAxis ? fs + 12 : 4
    const plotW = 360
    const plotH = n * step
    open(pad * 2 + mLeft + plotW + mRight, pad * 2 + mTop + plotH + mBottom)
    parts.push(`<g transform="translate(${f1(pad + mLeft)} ${f1(pad + mTop)})">`)
    for (const t of ticks) {
      const x = scale(t)
      if (s.showGrid)
        parts.push(
          `<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${f1(
            plotH
          )}" stroke="${s.gridColor}" stroke-width="1"/>`
        )
      if (s.showValueAxis)
        parts.push(
          `<text x="${f1(x)}" y="${f1(
            plotH + fs + 2
          )}" text-anchor="middle" style="${fontStyle}">${xmlEscape(
            fmtTick(t)
          )}</text>`
        )
    }
    if (s.showCategoryAxis)
      parts.push(
        `<line x1="0" y1="0" x2="0" y2="${f1(plotH)}" stroke="${s.axisColor}" stroke-width="1.2"/>`
      )
    if (s.showValueAxis)
      parts.push(
        `<line x1="0" y1="${f1(plotH)}" x2="${f1(plotW)}" y2="${f1(
          plotH
        )}" stroke="${s.axisColor}" stroke-width="1.2"/>`
      )
    data.forEach((d, i) => {
      const y = i * step + gap / 2
      const bw = scale(disp(d.count))
      parts.push(
        `<rect x="0" y="${f1(y)}" width="${f1(bw)}" height="${f1(
          thick
        )}" fill="${fillOf(d.id)}"/>`
      )
      if (s.showCategoryAxis)
        parts.push(
          `<text x="-8" y="${f1(
            y + thick / 2
          )}" text-anchor="end" dominant-baseline="central" style="${fontStyle}">${xmlEscape(
            d.name
          )}</text>`
        )
      if (s.showValues)
        parts.push(
          `<text x="${f1(bw + 6)}" y="${f1(
            y + thick / 2
          )}" dominant-baseline="central" style="${fontStyle}">${xmlEscape(
            fmtVal(d.count)
          )}</text>`
        )
    })
    parts.push(`</g>`)
  }
  parts.push(`</svg>`)
  return parts.join("\n")
}
