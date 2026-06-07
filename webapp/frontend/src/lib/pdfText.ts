// Extrahiert den Text aus einem PDF – komplett im Browser (pdfjs-dist).
// Eine Zeichenkette je Seite. Wird nur bei Bedarf geladen (eigener Chunk).

import * as pdfjsLib from "pdfjs-dist"
// Worker als eigene Asset-URL (Vite) – sonst läuft das Parsing im Main-Thread.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Liefert den Text je Seite. Leere Seiten ergeben "".
export async function extractPdfText(file: File): Promise<string[]> {
  const data = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data })
  const doc = await loadingTask.promise
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      let text = ""
      for (const it of content.items) {
        if (!("str" in it)) continue
        const eol = "hasEOL" in it && it.hasEOL
        // Silbentrennung am Zeilenende ("Kommunika-\n tion") zusammenführen –
        // ohne Bindestrich und ohne Leerzeichen. Ergänzungsstriche mitten in der
        // Zeile ("Nord- und") bleiben unangetastet.
        if (eol && /\p{L}-$/u.test(it.str)) text += it.str.slice(0, -1)
        else text += it.str + " "
      }
      pages.push(text.replace(/[ \t]+/g, " ").trim())
      page.cleanup()
    }
    return pages
  } finally {
    await loadingTask.destroy()
  }
}
