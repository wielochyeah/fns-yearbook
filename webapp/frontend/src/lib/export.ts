// Client-seitiger Export: echter Ordner via File System Access API
// (Chrome/Edge) oder ZIP-Download als Fallback (Safari/Firefox).

import JSZip from "jszip"

export type ExportFile = { name: string; content: string }

export const supportsDirectoryPicker =
  typeof window !== "undefined" && "showDirectoryPicker" in window

export async function saveToDirectory(
  files: ExportFile[]
): Promise<{ dir: string; count: number }> {
  const picker = (window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<
      FileSystemDirectoryHandleLike
    >
  }).showDirectoryPicker
  if (!picker) {
    throw new Error("Ordner-Auswahl wird in diesem Browser nicht unterstützt.")
  }
  const dir = await picker({ mode: "readwrite" })
  for (const f of files) {
    const fh = await dir.getFileHandle(f.name, { create: true })
    const writable = await fh.createWritable()
    await writable.write(f.content)
    await writable.close()
  }
  return { dir: dir.name ?? "Ordner", count: files.length }
}

export async function downloadZip(
  files: ExportFile[],
  zipName = "fnf-jahrbuch-charts.zip"
): Promise<void> {
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, f.content)
  const blob = await zip.generateAsync({ type: "blob" })
  triggerDownload(blob, zipName)
}

export function downloadFile(
  name: string,
  content: string,
  type = "image/svg+xml"
): void {
  triggerDownload(new Blob([content], { type }), name)
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Minimal-Typen für die File System Access API (nicht überall in lib.dom)
interface FileSystemWritableLike {
  write(data: string | Blob): Promise<void>
  close(): Promise<void>
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableLike>
}
interface FileSystemDirectoryHandleLike {
  name: string
  getFileHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<FileSystemFileHandleLike>
}
