// Montserrat-Unterstützung: im Browser laden (für Vorschau + Canvas-Messung)
// und als base64-@font-face liefern, damit es in jedes SVG eingebettet werden
// kann – so sehen die exportierten SVGs überall korrekt aus, auch ohne
// installiertes Montserrat.
import w400 from "@fontsource/montserrat/files/montserrat-latin-400-normal.woff2"
import w500 from "@fontsource/montserrat/files/montserrat-latin-500-normal.woff2"
import w600 from "@fontsource/montserrat/files/montserrat-latin-600-normal.woff2"
import w700 from "@fontsource/montserrat/files/montserrat-latin-700-normal.woff2"
import w800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff2"

// Font-family-Stack für Montserrat (mit Fallbacks).
export const MONTSERRAT_STACK = "'Montserrat', Arial, Helvetica, sans-serif"

export type FontWeightOption = { label: string; value: string }

// Verfügbare Schnitte (font-weight). Werte passen zu den geladenen woff2-Dateien.
export const FONT_WEIGHTS: FontWeightOption[] = [
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "SemiBold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "ExtraBold", value: "800" },
]

const MONT_URLS: Record<string, string> = {
  "400": w400,
  "500": w500,
  "600": w600,
  "700": w700,
  "800": w800,
}

export function isMontserrat(fontFamily: string): boolean {
  return fontFamily.includes("Montserrat")
}

function urlFor(weight: string): string {
  return MONT_URLS[weight] ?? MONT_URLS["700"]
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const loaded = new Set<string>()
const cssCache = new Map<string, string>()

// Stellt sicher, dass Montserrat im gewünschten Gewicht im Browser registriert
// ist – nötig für die Vorschau und die korrekte Canvas-Breitenmessung.
async function ensureLoaded(weight: string): Promise<void> {
  if (loaded.has(weight)) return
  if (typeof FontFace === "undefined" || !document.fonts) return
  try {
    const face = new FontFace("Montserrat", `url(${urlFor(weight)})`, {
      weight,
      style: "normal",
    })
    await face.load()
    document.fonts.add(face)
    loaded.add(weight)
  } catch {
    // Ohne geladene Schrift wird ersatzweise (Fallback) gemessen.
  }
}

// Liefert ein @font-face-CSS mit eingebetteter woff2 (base64) für genau dieses
// Gewicht. Wird in jedes SVG eingebettet.
async function fontFaceCss(weight: string): Promise<string> {
  const cached = cssCache.get(weight)
  if (cached) return cached
  const res = await fetch(urlFor(weight))
  const b64 = arrayBufferToBase64(await res.arrayBuffer())
  const css =
    `@font-face{font-family:'Montserrat';font-style:normal;` +
    `font-weight:${weight};` +
    `src:url(data:font/woff2;base64,${b64}) format('woff2');}`
  cssCache.set(weight, css)
  return css
}

// Bequemer Kombi-Aufruf: lädt Montserrat für die Vorschau und liefert das
// Einbett-CSS für die exportierten SVGs.
export async function prepareMontserrat(weight: string): Promise<string> {
  await ensureLoaded(weight)
  return fontFaceCss(weight)
}
