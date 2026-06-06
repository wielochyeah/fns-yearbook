import { useMemo, useState, type CSSProperties } from "react"
import { Download, FolderOpen, FileArchive, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { FileDropzone } from "@/components/FileDropzone"

import type { ParsedWorkbook } from "@/lib/excel"
import {
  buildSvg,
  assignFilenames,
  DEFAULT_CONFIG,
  type Trait,
} from "@/lib/sliderChart"
import {
  downloadFile,
  downloadZip,
  saveToDirectory,
  supportsDirectoryPicker,
  type ExportFile,
} from "@/lib/export"

type Props = {
  file: File | null
  parsed: ParsedWorkbook | null
  busy: boolean
  onSelect: (f: File | null) => void
  onLoadSample: () => void
}

type Chart = { name: string; filename: string; svg: string }

// Web-sichere Schriften (müssen beim Öffnen des SVG vorhanden sein)
const FONTS: { label: string; value: string }[] = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
]

// Schachbrett-Hintergrund, um Transparenz in der Vorschau sichtbar zu machen
const CHECKER_STYLE: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
}

export function ChartsPage({
  file,
  parsed,
  busy,
  onSelect,
  onLoadSample,
}: Props) {
  const [barColor, setBarColor] = useState(DEFAULT_CONFIG.barColor)
  const [markerColor, setMarkerColor] = useState(DEFAULT_CONFIG.markerColor)
  const [transparent, setTransparent] = useState(true)
  const [fontFamily, setFontFamily] = useState(DEFAULT_CONFIG.fontFamily)

  const charts = useMemo<Chart[]>(() => {
    if (!parsed) return []
    const cfg = { ...DEFAULT_CONFIG, barColor, markerColor, transparent, fontFamily }
    const filenames = assignFilenames(parsed.people.map((p) => p.name))
    return parsed.people.map((p, i) => {
      const traits: Trait[] = parsed.traits.map((label, j) => ({
        label,
        value: p.values[j] ?? 0,
      }))
      return { name: p.name, filename: filenames[i], svg: buildSvg(traits, cfg) }
    })
  }, [parsed, barColor, markerColor, transparent, fontFamily])

  const files: ExportFile[] = charts.map((c) => ({
    name: c.filename,
    content: c.svg,
  }))

  async function exportFolder() {
    try {
      const { dir, count } = await saveToDirectory(files)
      toast.success(`${count} SVG(s) gespeichert`, { description: dir })
    } catch (err) {
      if ((err as Error).name === "AbortError") return // abgebrochen
      toast.error("Export fehlgeschlagen", { description: (err as Error).message })
    }
  }

  async function exportZip() {
    try {
      await downloadZip(files)
      toast.success(`ZIP mit ${files.length} SVG(s) erstellt`)
    } catch (err) {
      toast.error("ZIP fehlgeschlagen", { description: (err as Error).message })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Steuerung */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">1</Badge> Excel-Datei
            </CardTitle>
            <CardDescription>
              Spalte „Name“ → Dateiname, Spalten S–W → Eigenschaften (0–100 %).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FileDropzone
              file={file}
              onSelect={onSelect}
              onLoadSample={onLoadSample}
              busy={busy}
            />
            {parsed && parsed.traits.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsed.traits.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">2</Badge> Darstellung
            </CardTitle>
            <CardDescription>Farben wie im Vorlagen-Chart.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="font">
                Schriftart
              </Label>
              <select
                id="font"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="h-8 w-40 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <ColorRow label="Balkenfarbe" value={barColor} onChange={setBarColor} />
            <ColorRow
              label="Markerfarbe"
              value={markerColor}
              onChange={setMarkerColor}
            />
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="transparent">
                Transparenter Hintergrund
              </Label>
              <Switch
                id="transparent"
                checked={transparent}
                onCheckedChange={setTransparent}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">3</Badge> Export
            </CardTitle>
            <CardDescription>
              {supportsDirectoryPicker
                ? "Ordner wählen oder als ZIP herunterladen."
                : "Als ZIP herunterladen (Ordner-Export: Chrome/Edge)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {supportsDirectoryPicker && (
              <Button size="lg" onClick={exportFolder} disabled={!charts.length}>
                <FolderOpen /> In Ordner speichern
              </Button>
            )}
            <Button
              size="lg"
              variant={supportsDirectoryPicker ? "outline" : "default"}
              onClick={exportZip}
              disabled={!charts.length}
            >
              <FileArchive /> Als ZIP herunterladen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Vorschau */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Vorschau{" "}
            {charts.length > 0 && (
              <span className="text-foreground">({charts.length})</span>
            )}
          </h2>
        </div>
        <Separator />

        {charts.length === 0 ? (
          <EmptyState text="Noch keine Vorschau – wähle eine Excel-Datei oder lade die Beispieldaten." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {charts.map((c) => (
              <Card key={c.filename} className="gap-3 overflow-hidden py-4">
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{c.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => downloadFile(c.filename, c.svg)}
                      title="SVG herunterladen"
                    >
                      <Download className="size-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <div
                    className="overflow-hidden rounded-md border [&>svg]:h-auto [&>svg]:w-full"
                    style={transparent ? CHECKER_STYLE : { backgroundColor: "#ffffff" }}
                    dangerouslySetInnerHTML={{ __html: c.svg }}
                  />
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {c.filename}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
      <FileSpreadsheet className="size-10 text-muted-foreground/50" />
      <div className="max-w-xs text-sm text-muted-foreground">{text}</div>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 font-mono text-xs"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5"
          aria-label={label}
        />
      </div>
    </div>
  )
}
