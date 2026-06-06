// Wandelt einen befüllten Template-SVG-String (eine Doppelseite) in ein
// druckfähiges PDF (Uint8Array) um – vollständig im Browser, ohne Server.
//
// Strategie (RASTER): Der befüllte SVG enthält Montserrat bereits als
// base64-@font-face und alle Bilder/den Chart als data:-URLs. Wir lassen die
// SVG vom Browser in ein <img> rendern (dabei werden Schrift + verschachtelte
// SVG + gedrehter Text korrekt gerastert), zeichnen das in ein High-DPI-Canvas
// und betten dieses Bitmap in ein jsPDF in exakter Seitengröße ein.
//
// Warum Raster statt svg2pdf.js: svg2pdf ignoriert das eingebettete @font-face
// und erwartet Schriften in jsPDFs VFS (nur TTF/OTF) – @fontsource liefert aber
// nur woff2. Zudem ist svg2pdf bei verschachtelten SVGs, rotate()-Transforms und
// preserveAspectRatio='slice' fragil. Der Browser rendert all das korrekt;
// das Raster-Ergebnis ist verlässlich und auf den ersten Versuch druckfähig.

import { jsPDF } from "jspdf"

// Ausgabeauflösung. SVG-Einheiten gelten als CSS-px (96 dpi). Für Druck
// rastern wir auf 300 dpi -> Faktor 300/96. Höher = schärfer, aber mehr RAM.
const TARGET_DPI = 300
const CSS_DPI = 96
const SCALE = TARGET_DPI / CSS_DPI // ~3.125

// PDF rechnet in Punkten (1 pt = 1/72 inch). SVG-px -> pt: * 72/96.
const PT_PER_PX = 72 / CSS_DPI // 0.75

type Dims = { width: number; height: number }

// Liest width/height aus der viewBox (oder den width/height-Attributen).
function readDims(svg: Element): Dims {
  const vb = svg.getAttribute("viewBox")
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number)
    if (p.length === 4 && p[2] > 0 && p[3] > 0) {
      return { width: p[2], height: p[3] }
    }
  }
  const w = parseFloat(svg.getAttribute("width") || "")
  const h = parseFloat(svg.getAttribute("height") || "")
  if (w > 0 && h > 0) return { width: w, height: h }
  // Sicherer Fallback auf die bekannte Doppelseiten-Größe.
  return { width: 1396.32, height: 681.2 }
}

// Setzt explizite width/height (= viewBox-Maße) auf den SVG-Wurzelknoten, damit
// das <img> deterministische Intrinsic-Maße hat und scharf rastert. Stellt
// außerdem den SVG-Namespace sicher (für das Laden als image/svg+xml nötig).
function withExplicitSize(svgStr: string, dims: Dims): string {
  const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml")
  const svg = doc.documentElement
  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  }
  if (!svg.getAttribute("xmlns:xlink")) {
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
  }
  svg.setAttribute("width", String(dims.width))
  svg.setAttribute("height", String(dims.height))
  return new XMLSerializer().serializeToString(doc)
}

// Lädt einen SVG-String als <img>. data:-URL statt Blob-URL, damit das Bild
// garantiert "same-origin" ist (kein Canvas-Tainting) – alle Inhalte sind
// ohnehin schon base64 (Schrift, Bilder, Chart).
function loadSvgImage(svgStr: string): Promise<HTMLImageElement> {
  // Unicode-sicheres base64 (btoa kann kein >0xFF), daher UTF-8 -> %-Encode.
  const b64 = btoa(unescape(encodeURIComponent(svgStr)))
  const url = `data:image/svg+xml;base64,${b64}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = "sync"
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error("SVG konnte nicht als Bild geladen werden."))
    img.src = url
  })
}

/**
 * Rendert einen befüllten Template-SVG-String in ein druckfähiges PDF.
 * @param svgStr  vollständiger, eigenständiger SVG-String (aus fillTemplate)
 * @returns       PDF als Uint8Array (für JSZip / File System Access API)
 */
export async function templateSvgToPdf(svgStr: string): Promise<Uint8Array> {
  // 1) Maße bestimmen.
  const probe = new DOMParser().parseFromString(svgStr, "image/svg+xml")
  const dims = readDims(probe.documentElement)

  // 2) Explizite Größe setzen und als Bild laden.
  const sized = withExplicitSize(svgStr, dims)
  const img = await loadSvgImage(sized)
  // Manche Engines brauchen decode(), damit das Bitmap wirklich bereitsteht.
  if (typeof img.decode === "function") {
    try {
      await img.decode()
    } catch {
      // onload hat bereits gefeuert; weiter mit drawImage.
    }
  }

  // 3) High-DPI-Canvas und zeichnen.
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(dims.width * SCALE))
  canvas.height = Math.max(1, Math.round(dims.height * SCALE))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas-2D-Kontext nicht verfügbar.")
  // Weißer Hintergrund (PDF/Druck: keine Transparenz).
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // 4) Seitengröße in Punkten; Ausrichtung aus Seitenverhältnis.
  const widthPt = dims.width * PT_PER_PX
  const heightPt = dims.height * PT_PER_PX
  const orientation: "l" | "p" = widthPt >= heightPt ? "l" : "p"

  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [widthPt, heightPt],
    compress: true,
  })

  // 5) Canvas direkt einbetten (jsPDF 4.x akzeptiert HTMLCanvasElement).
  pdf.addImage(canvas, "PNG", 0, 0, widthPt, heightPt, undefined, "FAST")

  // 6) Als Uint8Array ausgeben (JSZip + File System Access API mögen das).
  const buf = pdf.output("arraybuffer") as ArrayBuffer
  return new Uint8Array(buf)
}
