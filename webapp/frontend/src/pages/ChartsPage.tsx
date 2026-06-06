import { useEffect, useState, type CSSProperties } from "react"
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
import {
  FONT_WEIGHTS,
  MONTSERRAT_STACK,
  isMontserrat,
  prepareMontserrat,
} from "@/lib/fonts"

type Props = {
  file: File | null
  parsed: ParsedWorkbook | null
  busy: boolean
  onSelect: (f: File | null) => void
  onLoadSample: () => void
}

type Chart = { name: string; filename: string; svg: string }

// Schriften. Montserrat wird in die SVGs eingebettet (base64), die übrigen sind
// websicher und müssen beim Öffnen des SVG vorhanden sein.
const FONTS: { label: string; value: string }[] = [
  { label: "Montserrat", value: MONTSERRAT_STACK },
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
  const [fontFamily, setFontFamily] = useState(MONTSERRAT_STACK)
  const [fontWeight, setFontWeight] = useState("700")
  const [fontSize, setFontSize] = useState(DEFAULT_CONFIG.labelFontSize)
  const [labelAlign, setLabelAlign] = useState<"left" | "right">("right")
  const [textSide, setTextSide] = useState<"left" | "right">("left")
  const [charts, setCharts] = useState<Chart[]>([])
  // Aus dem Excel-Sheet extrahierte Eigenschafts-Beschriftungen – im Frontend
  // editierbar. Wird bei jeder neuen Datei aus parsed.traits neu befüllt.
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    setLabels(parsed?.traits ?? [])
  }, [parsed])

  const labelsDirty =
    !!parsed &&
    (labels.length !== parsed.traits.length ||
      labels.some((l, j) => l !== parsed.traits[j]))

  // Chart-Erzeugung ist asynchron, weil Montserrat erst geladen/eingebettet
  // werden muss (Vorschau + base64-@font-face fürs SVG).
  useEffect(() => {
    let cancelled = false
    async function build() {
      if (!parsed) {
        setCharts([])
        return
      }
      let fontFaceCss: string | undefined
      if (isMontserrat(fontFamily)) {
        fontFaceCss = await prepareMontserrat(fontWeight)
        if (cancelled) return
      }
      const labelFontSize = Math.min(72, Math.max(12, Math.round(fontSize) || 30))
      // Zeilenhöhe mit der Schriftgröße skalieren (30 → 66 = bisheriges Default),
      // aber nie kleiner als der Marker, damit nichts überlappt.
      const rowHeight = Math.max(48, Math.round(labelFontSize * 2.2))
      const cfg = {
        ...DEFAULT_CONFIG,
        barColor,
        markerColor,
        transparent,
        fontFamily,
        fontWeight,
        labelFontSize,
        labelAlign,
        textSide,
        rowHeight,
        fontFaceCss,
      }
      const filenames = assignFilenames(parsed.people.map((p) => p.name))
      const next = parsed.people.map((p, i) => {
        const traits: Trait[] = parsed.traits.map((orig, j) => ({
          label: labels[j] ?? orig,
          value: p.values[j] ?? 0,
        }))
        return { name: p.name, filename: filenames[i], svg: buildSvg(traits, cfg) }
      })
      if (!cancelled) setCharts(next)
    }
    build()
    return () => {
      cancelled = true
    }
  }, [
    parsed,
    labels,
    barColor,
    markerColor,
    transparent,
    fontFamily,
    fontWeight,
    fontSize,
    labelAlign,
    textSide,
  ])

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
              Die Beschriftungen lassen sich unten anpassen.
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
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Beschriftungen ({parsed.traits.length})
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setLabels(parsed.traits)}
                    disabled={!labelsDirty}
                  >
                    Zurücksetzen
                  </Button>
                </div>
                {parsed.traits.map((orig, j) => (
                  <Input
                    key={j}
                    value={labels[j] ?? orig}
                    placeholder={orig}
                    onChange={(e) => {
                      const value = e.target.value
                      setLabels((prev) => {
                        const base =
                          prev.length === parsed.traits.length
                            ? prev
                            : parsed.traits
                        const next = base.slice()
                        next[j] = value
                        return next
                      })
                    }}
                    className="h-8 text-sm"
                  />
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
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="font-weight">
                Schriftschnitt
              </Label>
              <select
                id="font-weight"
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value)}
                className="h-8 w-40 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="font-size">
                Schriftgröße
              </Label>
              <Input
                id="font-size"
                type="number"
                min={12}
                max={72}
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) setFontSize(v)
                }}
                className="h-8 w-40"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="label-left">
                Beschriftung linksbündig
              </Label>
              <Switch
                id="label-left"
                checked={labelAlign === "left"}
                onCheckedChange={(v) => setLabelAlign(v ? "left" : "right")}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="swap-sides">
                Balken links, Text rechts
              </Label>
              <Switch
                id="swap-sides"
                checked={textSide === "right"}
                onCheckedChange={(v) => setTextSide(v ? "right" : "left")}
              />
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
