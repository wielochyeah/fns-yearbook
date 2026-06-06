import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  Download,
  FolderOpen,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Settings,
  Crop,
  X,
} from "lucide-react"
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
import { extractRowImages } from "@/lib/xlsxImages"
import {
  fillTemplate,
  buildMergeCsv,
  configWeights,
  mergeConfig,
  templateFontSizes,
  templateImageAspect,
  DEFAULT_TEMPLATE_CONFIG,
  ICON_OPTIONS,
  type TemplateConfig,
  type FieldSetting,
} from "@/lib/template"
import { templateSvgToPdf } from "@/lib/templatePdf"

const TPL_CONFIG_KEY = "fnf-template-config"

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
  // Steckbrief-Template (Illustrator-SVG) + Fotoquelle
  const [templateSvg, setTemplateSvg] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [photoSource, setPhotoSource] = useState<"excel" | "upload">("excel")
  // Alle hochgeladenen Bilddateien (Name + Daten-URL + natürliche Maße).
  const [uploadedFiles, setUploadedFiles] = useState<
    { fileName: string; dataUrl: string; w: number; h: number }[]
  >([])
  // Zuordnung Person (Excel-Zeile) -> Dateiname; automatisch per Vorname_Nachname,
  // im Frontend manuell überschreibbar.
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  // Bildausschnitt (Fokuspunkt 0..1) je Person für das Fill; Default = Mitte.
  const [crops, setCrops] = useState<Record<number, { x: number; y: number }>>(
    {}
  )
  const [tplBusy, setTplBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tplConfig, setTplConfig] = useState<TemplateConfig>(() => {
    try {
      const raw = localStorage.getItem(TPL_CONFIG_KEY)
      return mergeConfig(raw ? JSON.parse(raw) : null)
    } catch {
      return DEFAULT_TEMPLATE_CONFIG
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(TPL_CONFIG_KEY, JSON.stringify(tplConfig))
    } catch {
      /* ignore */
    }
  }, [tplConfig])
  // In der Vorlage verwendete Schriftgrößen je Feld (für die Platzhalter im Popup).
  const tplSizes = useMemo(
    () => (templateSvg ? templateFontSizes(templateSvg) : {}),
    [templateSvg]
  )
  // Seitenverhältnis des Foto-Rahmens (für die Cropper-Vorschau).
  const tplAspect = useMemo(
    () => (templateSvg ? templateImageAspect(templateSvg) : 1),
    [templateSvg]
  )
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

  // Normalisierung fürs Matching: Umlaute/ß transliterieren (Dateinamen nutzen
  // oft „Mueller“/„Gross“ statt „Müller“/„Groß“), dann Sonderzeichen entfernen.
  const normName = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "")
  // Schlüssel aus Vor- + Nachname, reihenfolge-unabhängig sortiert – passt für
  // „Nachname_Vorname“ wie auch „Vorname_Nachname“. Zweitnamen werden ignoriert.
  const pairKey = (a: string, b: string) =>
    [normName(a), normName(b)].sort().join("|")
  const personKey = (name: string) => {
    const t = name.trim().split(/\s+/).filter(Boolean)
    return t.length ? pairKey(t[0], t[t.length - 1]) : ""
  }
  // Dateiname „Nachname_Vorname.ext“ -> selber Schlüssel (Trenner _ . - Leerzeichen).
  const fileNameKey = (fileName: string) => {
    const t = fileName
      .replace(/\.[^.]+$/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
    return t.length ? pairKey(t[0], t[t.length - 1]) : ""
  }

  // Ordnet jeder noch freien Person die namentlich passende, noch freie Datei zu.
  function autoAssign(
    files: { fileName: string; dataUrl: string }[],
    prev: Record<number, string>
  ): Record<number, string> {
    if (!parsed) return prev
    const next = { ...prev }
    const used = new Set(Object.values(next))
    const byKey = new Map<string, string>()
    for (const f of files) {
      const k = fileNameKey(f.fileName)
      if (k && !byKey.has(k)) byKey.set(k, f.fileName)
    }
    let changed = false
    for (const p of parsed.people) {
      if (next[p.rowExcel]) continue
      const fn = byKey.get(personKey(p.name))
      if (fn && !used.has(fn)) {
        next[p.rowExcel] = fn
        used.add(fn)
        changed = true
      }
    }
    return changed ? next : prev
  }

  function onTemplateFile(f: File | null) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setTemplateSvg(String(reader.result))
      setTemplateName(f.name)
    }
    reader.readAsText(f)
  }

  function onPhotoFiles(list: FileList | null) {
    if (!list || !list.length) return
    Promise.all(
      Array.from(list).map(
        (f) =>
          new Promise<{
            fileName: string
            dataUrl: string
            w: number
            h: number
          }>((res) => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = String(reader.result)
              // Natürliche Maße bestimmen (für Bildausschnitt/Fill).
              const img = new Image()
              img.onload = () =>
                res({
                  fileName: f.name,
                  dataUrl,
                  w: img.naturalWidth,
                  h: img.naturalHeight,
                })
              img.onerror = () => res({ fileName: f.name, dataUrl, w: 0, h: 0 })
              img.src = dataUrl
            }
            reader.onerror = () =>
              res({ fileName: f.name, dataUrl: "", w: 0, h: 0 })
            reader.readAsDataURL(f)
          })
      )
    ).then((read) => {
      const merged = [...uploadedFiles]
      for (const f of read.filter((x) => x.dataUrl)) {
        const i = merged.findIndex((m) => m.fileName === f.fileName)
        if (i >= 0) merged[i] = f
        else merged.push(f)
      }
      setUploadedFiles(merged)
      setAssignments((prev) => autoAssign(merged, prev))
    })
  }

  // Wenn Excel und Bilder beide vorhanden sind (z. B. Bilder vor dem Generieren
  // hochgeladen), Auto-Zuordnung nachziehen.
  useEffect(() => {
    if (!parsed || !uploadedFiles.length) return
    setAssignments((prev) => autoAssign(uploadedFiles, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, uploadedFiles])

  async function exportTemplateZip() {
    if (!parsed || !templateSvg || charts.length !== parsed.people.length) return
    setTplBusy(true)
    try {
      // Montserrat-Einbett-CSS für alle in der Config genutzten Gewichte.
      const cssParts: string[] = []
      for (const w of configWeights(tplConfig))
        cssParts.push(await prepareMontserrat(w))
      const css = cssParts.join("\n")
      // Sicherstellen, dass die Schriften geladen sind, bevor gerastert wird.
      if (document.fonts?.ready) await document.fonts.ready
      // Fotos: aus Excel extrahieren oder aus Upload (nach Name).
      let rowImages = new Map<number, string>()
      if (photoSource === "excel" && file) rowImages = await extractRowImages(file)
      let withPhoto = 0
      // Sequentiell (nicht parallel): ein 300-dpi-Canvas pro Person, sonst Spitzen-RAM.
      const out: ExportFile[] = []
      for (let i = 0; i < parsed.people.length; i++) {
        const p = parsed.people[i]
        const upFile =
          photoSource === "upload"
            ? uploadedFiles.find((f) => f.fileName === assignments[p.rowExcel])
            : undefined
        const photo =
          photoSource === "excel"
            ? rowImages.get(p.rowExcel) ?? null
            : upFile?.dataUrl ?? null
        if (photo) withPhoto++
        const svg = fillTemplate({
          templateSvg,
          header: parsed.header,
          row: parsed.rows[p.rowExcel - 2],
          name: p.name,
          chartSvg: charts[i].svg,
          photoDataUrl: photo,
          photoSize: upFile && upFile.w > 0 ? { w: upFile.w, h: upFile.h } : undefined,
          photoCrop: crops[p.rowExcel],
          fontFaceCss: css,
          config: tplConfig,
        })
        const pdf = await templateSvgToPdf(svg)
        const base = charts[i].filename.replace(/\.svg$/i, "")
        out.push({ name: `${base}_steckbrief.svg`, content: svg })
        out.push({ name: `${base}_steckbrief.pdf`, content: pdf })
      }
      // CSV der zusammengeführten Daten mit ins ZIP.
      const csv = buildMergeCsv({
        people: parsed.people.map((p) => ({
          name: p.name,
          row: parsed.rows[p.rowExcel - 2],
        })),
        header: parsed.header,
        config: tplConfig,
      })
      out.push({ name: "daten.csv", content: csv })
      await downloadZip(out, "steckbriefe.zip")
      toast.success(
        `${parsed.people.length} Steckbrief(e) als PDF + SVG + CSV – ${withPhoto} mit Foto`
      )
    } catch (err) {
      toast.error("Steckbriefe fehlgeschlagen", {
        description: (err as Error).message,
      })
    } finally {
      setTplBusy(false)
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">4</Badge> Steckbriefe (Vorlage)
            </CardTitle>
            <CardDescription>
              Illustrator-Vorlage (SVG) hochladen → pro Person eine gefüllte
              Doppelseite mit Chart + Foto. Ergebnis: 1 PDF pro Steckbrief im ZIP.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              type="file"
              accept=".svg,image/svg+xml"
              className="h-9 text-sm"
              onChange={(e) => onTemplateFile(e.target.files?.[0] ?? null)}
            />
            {templateName && (
              <div className="truncate text-xs text-muted-foreground">
                {templateName}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm" htmlFor="photo-source">
                Fotoquelle
              </Label>
              <select
                id="photo-source"
                value={photoSource}
                onChange={(e) =>
                  setPhotoSource(e.target.value as "excel" | "upload")
                }
                className="h-8 w-40 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="excel">Aus Excel</option>
                <option value="upload">Hochladen</option>
              </select>
            </div>
            {photoSource === "upload" && (
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="h-9 text-sm"
                  onChange={(e) => onPhotoFiles(e.target.files)}
                />
                <div className="text-xs text-muted-foreground">
                  {uploadedFiles.length} Datei(en) – Dateiname = Nachname_Vorname
                  (z. B. „Mustermann_Max.jpg“), Reihenfolge & Zweitnamen egal.
                </div>
                {parsed && uploadedFiles.length > 0 && (
                  <PhotoAssign
                    people={parsed.people}
                    files={uploadedFiles}
                    assignments={assignments}
                    crops={crops}
                    aspect={tplAspect}
                    onAssign={(rowExcel, fileName) =>
                      setAssignments((a) => {
                        const next = { ...a }
                        if (fileName) next[rowExcel] = fileName
                        else delete next[rowExcel]
                        return next
                      })
                    }
                    onCrop={(rowExcel, c) =>
                      setCrops((m) => ({ ...m, [rowExcel]: c }))
                    }
                  />
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-4" /> Einstellungen (Mapping, Schrift,
              Icons)
            </Button>
            <Button
              size="lg"
              onClick={exportTemplateZip}
              disabled={!templateSvg || !charts.length || tplBusy}
            >
              {tplBusy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileArchive />
              )}
              Steckbriefe (PDF + SVG + CSV) als ZIP
            </Button>
          </CardContent>
        </Card>
      </div>

      <TemplateSettings
        open={settingsOpen}
        config={tplConfig}
        headers={parsed?.header ?? []}
        defaultSizes={tplSizes}
        onChange={setTplConfig}
        onClose={() => setSettingsOpen(false)}
      />

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

const SELECT_CLS =
  "h-8 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

function TemplateSettings({
  open,
  config,
  headers,
  defaultSizes,
  onChange,
  onClose,
}: {
  open: boolean
  config: TemplateConfig
  headers: string[]
  defaultSizes: Record<string, number>
  onChange: (c: TemplateConfig) => void
  onClose: () => void
}) {
  if (!open) return null
  const update = (slug: string, patch: Partial<FieldSetting>) =>
    onChange({
      fields: { ...config.fields, [slug]: { ...config.fields[slug], ...patch } },
    })
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">
            Steckbrief-Einstellungen (Mapping · Präfix · Schrift · Größe · Icons)
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(DEFAULT_TEMPLATE_CONFIG)}
            >
              Zurücksetzen
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-[78px_minmax(0,1fr)_116px_100px_62px_84px] items-center gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
            <span>Feld</span>
            <span>Excel-Spalte</span>
            <span>Präfix</span>
            <span>Schnitt</span>
            <span>Größe</span>
            <span>Icon</span>
          </div>
          {Object.entries(config.fields).map(([slug, f]) => (
            <div
              key={slug}
              className="grid grid-cols-[78px_minmax(0,1fr)_116px_100px_62px_84px] items-center gap-2 py-1.5"
            >
              <span className="truncate text-sm" title={f.label}>
                {f.label}
              </span>
              {f.source === "column" ? (
                <select
                  className={SELECT_CLS}
                  value={f.column ?? ""}
                  onChange={(e) => update(slug, { column: e.target.value })}
                >
                  <option value="">—</option>
                  {headers
                    .filter((h) => h && h.trim() !== "")
                    .map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  {/* "-"-Spalte explizit anbieten */}
                  {headers.some((h) => (h ?? "").trim() === "-") && (
                    <option value="-">- (Spalte „-“)</option>
                  )}
                </select>
              ) : (
                <span className="truncate text-xs text-muted-foreground">
                  {f.source === "firstname"
                    ? "Name → Vorname"
                    : f.source === "surname"
                      ? "Name → Nachname"
                      : "statischer Text"}
                </span>
              )}
              {f.source !== "static" ? (
                <input
                  className={SELECT_CLS}
                  type="text"
                  value={f.prefix ?? ""}
                  placeholder="—"
                  title='Fester Text vor dem Wert, z. B. "Geburtsdatum: "'
                  onChange={(e) => update(slug, { prefix: e.target.value })}
                />
              ) : (
                <span />
              )}
              <select
                className={SELECT_CLS}
                value={f.weight}
                onChange={(e) => update(slug, { weight: e.target.value })}
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <input
                className={SELECT_CLS}
                type="number"
                min={4}
                step={1}
                value={f.fontSize ?? ""}
                placeholder={
                  defaultSizes[slug] != null ? String(defaultSizes[slug]) : "auto"
                }
                title="Schriftgröße in px (leer = Vorlagengröße, als Platzhalter angezeigt)"
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  update(slug, {
                    fontSize: Number.isFinite(n) && n > 0 ? n : undefined,
                  })
                }}
              />
              {slug.startsWith("Q") ? (
                <select
                  className={SELECT_CLS}
                  value={f.icon ?? ""}
                  onChange={(e) => update(slug, { icon: e.target.value })}
                >
                  {ICON_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}
            </div>
          ))}
          <p className="pt-3 text-xs text-muted-foreground">
            Größe leer = aus der Vorlage übernehmen. Präfix steht als fester Text
            vor dem Wert (z. B. „Geburtsdatum: “). Einstellungen werden im Browser
            gespeichert.
          </p>
        </div>

        <div className="border-t px-4 py-3 text-right">
          <Button size="sm" onClick={onClose}>
            Fertig
          </Button>
        </div>
      </div>
    </div>
  )
}

// Foto-Zuordnung: zeigt jede Person mit Vorschau ihres (auto-/manuell) zugeordneten
// Bildes. Nicht erkannte Personen lassen sich manuell einer hochgeladenen Datei
// zuordnen (bereits vergebene werden ausgeblendet). Über das Crop-Icon öffnet sich
// eine große Ansicht zum komfortablen Wählen des sichtbaren Ausschnitts.
function PhotoAssign({
  people,
  files,
  assignments,
  crops,
  aspect,
  onAssign,
  onCrop,
}: {
  people: { name: string; rowExcel: number }[]
  files: { fileName: string; dataUrl: string; w: number; h: number }[]
  assignments: Record<number, string>
  crops: Record<number, { x: number; y: number }>
  aspect: number
  onAssign: (rowExcel: number, fileName: string) => void
  onCrop: (rowExcel: number, c: { x: number; y: number }) => void
}) {
  const [editRow, setEditRow] = useState<number | null>(null)
  const fileOf = (rowExcel: number) => {
    const fn = assignments[rowExcel]
    return fn ? files.find((f) => f.fileName === fn) : undefined
  }
  const assignedElsewhere = (fileName: string, rowExcel: number) =>
    Object.entries(assignments).some(
      ([r, fn]) => fn === fileName && Number(r) !== rowExcel
    )
  const withPhoto = people.filter((p) => fileOf(p.rowExcel)).length
  const editFile = editRow != null ? fileOf(editRow) : undefined
  const editPerson =
    editRow != null ? people.find((p) => p.rowExcel === editRow) : undefined
  const W = 56
  const H = Math.round(W / (aspect || 1))
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
        <span>Foto-Zuordnung &amp; Bildausschnitt</span>
        <Badge variant={withPhoto === people.length ? "secondary" : "outline"}>
          {withPhoto}/{people.length} mit Foto
        </Badge>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {people.map((p) => {
          const f = fileOf(p.rowExcel)
          const current = f?.fileName ?? ""
          const crop = crops[p.rowExcel] ?? { x: 0.5, y: 0.5 }
          return (
            <div
              key={p.rowExcel}
              className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
            >
              {f ? (
                <button
                  type="button"
                  onClick={() => setEditRow(p.rowExcel)}
                  title="Bildausschnitt wählen"
                  className="group relative shrink-0 overflow-hidden rounded border bg-muted"
                  style={{ width: W, height: H }}
                >
                  <img
                    src={f.dataUrl}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${crop.x * 100}% ${crop.y * 100}%`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                    <Crop className="size-4" />
                  </span>
                </button>
              ) : (
                <div
                  className="flex shrink-0 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground"
                  style={{ width: W, height: H }}
                >
                  kein
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={`truncate text-sm ${current ? "" : "text-muted-foreground"}`}
                  title={p.name}
                >
                  {current ? "✓ " : "• "}
                  {p.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    className={SELECT_CLS}
                    value={current}
                    onChange={(e) => onAssign(p.rowExcel, e.target.value)}
                  >
                    <option value="">— kein Foto —</option>
                    {files
                      .filter((x) => !assignedElsewhere(x.fileName, p.rowExcel))
                      .map((x) => (
                        <option key={x.fileName} value={x.fileName}>
                          {x.fileName}
                        </option>
                      ))}
                  </select>
                  {f && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      title="Bildausschnitt wählen"
                      onClick={() => setEditRow(p.rowExcel)}
                    >
                      <Crop className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {editRow != null && editFile && editFile.w > 0 && (
        <CropModal
          src={editFile.dataUrl}
          imgW={editFile.w}
          imgH={editFile.h}
          aspect={aspect}
          title={editPerson?.name ?? ""}
          value={crops[editRow] ?? { x: 0.5, y: 0.5 }}
          onChange={(c) => onCrop(editRow, c)}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  )
}

// Große Ansicht zum Wählen des sichtbaren Bildausschnitts. Zeigt das ganze Foto;
// das Auswahlrechteck (im Rahmen-Seitenverhältnis, Cover-Größe) lässt sich per
// Klick/Ziehen positionieren, der Rest wird abgedunkelt. Der Fokuspunkt (0..1)
// entspricht 1:1 dem späteren Fill im SVG.
function CropModal({
  src,
  imgW,
  imgH,
  aspect,
  title,
  value,
  onChange,
  onClose,
}: {
  src: string
  imgW: number
  imgH: number
  aspect: number
  title: string
  value: { x: number; y: number }
  onChange: (c: { x: number; y: number }) => void
  onClose: () => void
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const ds = Math.min(560 / imgW, 460 / imgH)
  const dispW = imgW * ds
  const dispH = imgH * ds
  // Sichtbare Region (Bildpixel) = größtes Rechteck im Rahmen-Seitenverhältnis.
  const imgAspect = imgW / imgH
  const vw = imgAspect > aspect ? imgH * aspect : imgW
  const vh = imgAspect > aspect ? imgH : imgW / aspect
  const denomX = imgW - vw
  const denomY = imgH - vh
  const cx = Math.max(0, Math.min(1, value?.x ?? 0.5))
  const cy = Math.max(0, Math.min(1, value?.y ?? 0.5))
  const apply = (clientX: number, clientY: number) => {
    const r = areaRef.current?.getBoundingClientRect()
    if (!r) return
    const mx = (clientX - r.left) / ds
    const my = (clientY - r.top) / ds
    const left = Math.max(0, Math.min(denomX, mx - vw / 2))
    const top = Math.max(0, Math.min(denomY, my - vh / 2))
    onChange({
      x: denomX > 0.5 ? left / denomX : 0.5,
      y: denomY > 0.5 ? top / denomY : 0.5,
    })
  }
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] flex-col rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="truncate text-sm font-semibold">
            Bildausschnitt{title ? ` – ${title}` : ""}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-4">
          <div
            ref={areaRef}
            className="relative mx-auto cursor-crosshair select-none overflow-hidden rounded"
            style={{ width: dispW, height: dispH }}
            onMouseDown={(e) => {
              dragging.current = true
              apply(e.clientX, e.clientY)
            }}
            onMouseMove={(e) => dragging.current && apply(e.clientX, e.clientY)}
            onMouseUp={() => (dragging.current = false)}
            onMouseLeave={() => (dragging.current = false)}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none block h-full w-full object-contain"
            />
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: ds * cx * denomX,
                top: ds * cy * denomY,
                width: ds * vw,
                height: ds * vh,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            >
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
              <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
              <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
            </div>
          </div>
          <p className="pt-3 text-center text-xs text-muted-foreground">
            Klicken oder ziehen, um den sichtbaren Ausschnitt zu positionieren.
          </p>
        </div>
        <div className="border-t px-4 py-3 text-right">
          <Button size="sm" onClick={onClose}>
            Fertig
          </Button>
        </div>
      </div>
    </div>
  )
}
