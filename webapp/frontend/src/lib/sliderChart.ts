// Portierung von slider_chart.py (build_svg) nach TypeScript.
// Erzeugt pro Person ein SVG im Stil des Slider-/Likert-Vergleichscharts.

export type ChartConfig = {
  barColor: string
  markerColor: string
  textColor: string
  bgColor: string
  transparent: boolean
  fontFamily: string
  fontWeight: string
  labelFontSize: number
  // Ausrichtung der Beschriftungen in der Label-Spalte: "right" = bündig an den
  // Balken (Standard), "left" = linksbündig am äußeren Rand.
  labelAlign: "left" | "right"
  // Auf welcher Seite die Beschriftungen stehen: "left" = Text links/Balken
  // rechts (Standard), "right" = Balken links/Text rechts.
  textSide: "left" | "right"
  pad: number
  rowHeight: number
  gap: number
  barWidth: number
  barHeight: number
  barRadius: number
  markerWidth: number
  markerOverhang: number
  // Optionales @font-face-CSS (z. B. eingebettetes Montserrat als base64),
  // das in <defs><style> geschrieben wird, damit die Schrift im SVG überall
  // korrekt dargestellt wird.
  fontFaceCss?: string
}

export const DEFAULT_CONFIG: ChartConfig = {
  barColor: "#EBEBEB",
  markerColor: "#E72585",
  textColor: "#000000",
  bgColor: "#FFFFFF",
  transparent: true,
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: "bold",
  labelFontSize: 30,
  labelAlign: "right",
  textSide: "left",
  pad: 24,
  rowHeight: 66,
  gap: 34,
  barWidth: 500,
  barHeight: 30,
  barRadius: 9,
  markerWidth: 9,
  markerOverhang: 7,
}

export type Trait = { label: string; value: number }

// --- Textbreite per Canvas messen (genauer als eine Tabelle) --------------- #
let measureCtx: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, cfg: ChartConfig): number {
  if (!measureCtx) {
    const canvas = document.createElement("canvas")
    measureCtx = canvas.getContext("2d")
  }
  if (!measureCtx) return text.length * cfg.labelFontSize * 0.6
  measureCtx.font = `${cfg.fontWeight} ${cfg.labelFontSize}px ${cfg.fontFamily}`
  return measureCtx.measureText(text).width
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const f1 = (n: number) => n.toFixed(1)
const f0 = (n: number) => Math.round(n).toString()

export function buildSvg(
  traits: Trait[],
  cfg: ChartConfig = DEFAULT_CONFIG
): string {
  const n = traits.length

  const labelColW = traits.reduce(
    (max, t) => Math.max(max, measureTextWidth(t.label, cfg)),
    0
  )

  // Seiten je nach textSide: Standard Text links/Balken rechts, sonst getauscht.
  const textOnRight = cfg.textSide === "right"
  const barX = textOnRight ? cfg.pad : cfg.pad + labelColW + cfg.gap
  const labelLeftX = textOnRight ? cfg.pad + cfg.barWidth + cfg.gap : cfg.pad
  const labelRightX = labelLeftX + labelColW

  const width = cfg.pad * 2 + labelColW + cfg.gap + cfg.barWidth
  const height = cfg.pad * 2 + n * cfg.rowHeight
  const markerH = cfg.barHeight + 2 * cfg.markerOverhang

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f0(width)}" height="${f0(
      height
    )}" viewBox="0 0 ${f0(width)} ${f0(height)}">`
  )
  // Eingebettete Schrift (z. B. Montserrat als base64) – muss vor den <text>
  // stehen, damit sie beim Rendern verfügbar ist. base64 + plain CSS enthalten
  // keine XML-Sonderzeichen, daher ohne CDATA gültig (XML und HTML).
  if (cfg.fontFaceCss) {
    parts.push(
      `<defs><style type="text/css">${cfg.fontFaceCss}</style></defs>`
    )
  }
  // Hintergrund-Rechteck nur wenn nicht transparent
  if (!cfg.transparent) {
    parts.push(
      `<rect x="0" y="0" width="${f0(width)}" height="${f0(height)}" fill="${
        cfg.bgColor
      }"/>`
    )
  }

  traits.forEach((trait, i) => {
    const value = clamp(Number(trait.value) || 0, 0, 100)
    const rowCenter = cfg.pad + cfg.rowHeight / 2 + i * cfg.rowHeight
    const barY = rowCenter - cfg.barHeight / 2

    parts.push(
      `<rect x="${f1(barX)}" y="${f1(barY)}" width="${cfg.barWidth}" height="${
        cfg.barHeight
      }" rx="${cfg.barRadius}" ry="${cfg.barRadius}" fill="${cfg.barColor}"/>`
    )

    let mxCenter = barX + (value / 100) * cfg.barWidth
    mxCenter = clamp(
      mxCenter,
      barX + cfg.markerWidth / 2,
      barX + cfg.barWidth - cfg.markerWidth / 2
    )
    const markerX = mxCenter - cfg.markerWidth / 2
    const markerY = barY - cfg.markerOverhang
    parts.push(
      `<rect x="${f1(markerX)}" y="${f1(markerY)}" width="${
        cfg.markerWidth
      }" height="${markerH}" rx="${f1(cfg.markerWidth / 2)}" ry="${f1(
        cfg.markerWidth / 2
      )}" fill="${cfg.markerColor}"/>`
    )

    const baseline = rowCenter + cfg.labelFontSize * 0.35
    const leftAligned = cfg.labelAlign === "left"
    const textX = leftAligned ? labelLeftX : labelRightX
    const textAnchor = leftAligned ? "start" : "end"
    // Alle Font-Eigenschaften als Inline-Style: so überschreibt eine umgebende
    // CSS-Regel (z. B. im Steckbrief-Template) Font/Größe/Gewicht nicht – der
    // Chart sieht eingebettet exakt aus wie im Standalone-Export.
    parts.push(
      `<text x="${f1(textX)}" y="${f1(
        baseline
      )}" text-anchor="${textAnchor}" fill="${cfg.textColor}" style="font-family:${
        cfg.fontFamily
      };font-size:${cfg.labelFontSize}px;font-weight:${cfg.fontWeight}">${xmlEscape(
        trait.label
      )}</text>`
    )
  })

  parts.push("</svg>")
  return parts.join("\n")
}

// --- Dateinamen aus Personennamen (sanitisiert, eindeutig) ----------------- #
export function sanitizeFilename(name: string): string {
  let s = name.trim()
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen
  s = s.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
  s = s.replace(/^[. ]+|[. ]+$/g, "")
  return s || "unbenannt"
}

export function assignFilenames(names: string[]): string[] {
  const used = new Map<string, number>()
  return names.map((name) => {
    const base = sanitizeFilename(name)
    if (used.has(base)) {
      const next = (used.get(base) ?? 0) + 1
      used.set(base, next)
      return `${base}_${next}.svg`
    }
    used.set(base, 0)
    return `${base}.svg`
  })
}
