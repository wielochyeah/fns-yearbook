// Bilder aus einer .xlsx ziehen. Eine .xlsx ist ein ZIP; eingebettete Bilder
// liegen unter xl/media/ und sind über xl/drawings/*.xml an Zellen verankert.
// SheetJS liefert die Bilder nicht – darum parsen wir das ZIP selbst (JSZip).
//
// Unterstützt die verbreitete "schwebende" Variante (twoCellAnchor/oneCellAnchor).
// Rückgabe: Map von 1-basierter Excel-Zeile -> data-URL des Bildes.

import JSZip from "jszip"

export type RowImages = Map<number, string>

const REL_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

function mimeFromPath(p: string): string {
  const ext = p.toLowerCase().split(".").pop() || ""
  switch (ext) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "bmp":
      return "image/bmp"
    case "webp":
      return "image/webp"
    case "svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

// "xl/drawings/" + "../media/image1.png" -> "xl/media/image1.png"
function resolvePath(baseDir: string, target: string): string {
  const parts = (baseDir + target).split("/")
  const out: string[] = []
  for (const part of parts) {
    if (part === "" || part === ".") continue
    if (part === "..") out.pop()
    else out.push(part)
  }
  return out.join("/")
}

function parseRels(relsXml: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!relsXml) return map
  const doc = new DOMParser().parseFromString(relsXml, "application/xml")
  const rels = doc.getElementsByTagName("Relationship")
  for (let i = 0; i < rels.length; i++) {
    const id = rels[i].getAttribute("Id")
    const target = rels[i].getAttribute("Target")
    if (id && target) map[id] = target
  }
  return map
}

type Anchor = { row: number; embedId: string }

function parseAnchors(drawingXml: string): Anchor[] {
  const out: Anchor[] = []
  const doc = new DOMParser().parseFromString(drawingXml, "application/xml")
  const anchorTags = ["twoCellAnchor", "oneCellAnchor", "absoluteAnchor"]
  for (const tag of anchorTags) {
    const anchors = doc.getElementsByTagNameNS("*", tag)
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i]
      // "from"-Zelle: erstes <row>-Element im Anker (0-basiert)
      const rowEls = anchor.getElementsByTagNameNS("*", "row")
      const row = rowEls.length ? parseInt(rowEls[0].textContent || "0", 10) : 0
      // Bild-Referenz: <a:blip r:embed="rIdX">
      const blips = anchor.getElementsByTagNameNS("*", "blip")
      let embedId: string | null = null
      if (blips.length) {
        embedId =
          blips[0].getAttributeNS(REL_NS, "embed") ||
          blips[0].getAttribute("r:embed")
      }
      // Nur Zell-Anker (mit <row>) verwenden; absoluteAnchor hat keine Zeile
      // und würde sonst fälschlich auf Zeile 1 (Kopfzeile) gemappt.
      if (embedId && rowEls.length) out.push({ row: isNaN(row) ? 0 : row, embedId })
    }
  }
  return out
}

export async function extractRowImages(file: File): Promise<RowImages> {
  const map: RowImages = new Map()
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const drawingPaths = Object.keys(zip.files).filter((p) =>
      /^xl\/drawings\/drawing\d+\.xml$/.test(p)
    )
    for (const dpath of drawingPaths) {
      const drawingXml = await zip.files[dpath].async("string")
      const relsPath = dpath.replace(
        /drawings\/(drawing\d+\.xml)$/,
        "drawings/_rels/$1.rels"
      )
      const relsXml = zip.files[relsPath]
        ? await zip.files[relsPath].async("string")
        : ""
      const rels = parseRels(relsXml)
      for (const anchor of parseAnchors(drawingXml)) {
        const target = rels[anchor.embedId]
        if (!target) continue
        const mediaPath = resolvePath("xl/drawings/", target)
        const mediaFile = zip.files[mediaPath]
        if (!mediaFile) continue
        const b64 = await mediaFile.async("base64")
        const dataUrl = `data:${mimeFromPath(mediaPath)};base64,${b64}`
        // Anker-Zeile ist 0-basiert -> Excel-Zeile = row + 1
        map.set(anchor.row + 1, dataUrl)
      }
    }
  } catch {
    // Kein lesbares ZIP / keine Bilder -> leere Map (Fallback: Upload).
  }
  return map
}
