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
      const text = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim()
      pages.push(text)
      page.cleanup()
    }
    return pages
  } finally {
    await loadingTask.destroy()
  }
}
