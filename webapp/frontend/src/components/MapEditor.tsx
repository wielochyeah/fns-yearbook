import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Ban, Download, RotateCcw, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import {
  buildMapSvg,
  buildBarChartSvg,
  type MapStyle,
  type RegionGeo,
} from "@/lib/mapSvg"
import {
  FONT_WEIGHTS,
  MONTSERRAT_STACK,
  isMontserrat,
  prepareMontserrat,
} from "@/lib/fonts"
import { downloadFile } from "@/lib/export"

const FONTS: { label: string; value: string }[] = [
  { label: "Montserrat", value: MONTSERRAT_STACK },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
]

const SELECT_CLS =
  "h-8 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export type MapEditorProps = {
  regions: RegionGeo[]
  viewBox: { w: number; h: number }
  defaultStyle: MapStyle
  storageKey: string // localStorage-Präfix (…-counts / …-style)
  regionNoun: string // "Bundesland" / "Land"
  inputTitle: string // Titel der Eingabemaske
  svgFileName: string // Dateiname beim Export
  searchable?: boolean // Suche bei vielen Regionen
}

export function MapEditor({
  regions,
  viewBox,
  defaultStyle,
  storageKey,
  regionNoun,
  inputTitle,
  svgFileName,
  searchable,
}: MapEditorProps) {
  const sorted = useMemo(
    () => [...regions].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [regions]
  )

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}-counts`)
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return {}
  })
  const [style, setStyle] = useState<MapStyle>(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}-style`)
      if (raw) return { ...defaultStyle, ...JSON.parse(raw) }
    } catch {
      /* ignore */
    }
    return defaultStyle
  })
  const [search, setSearch] = useState("")

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-counts`, JSON.stringify(counts))
    } catch {
      /* ignore */
    }
  }, [counts, storageKey])
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-style`, JSON.stringify(style))
    } catch {
      /* ignore */
    }
  }, [style, storageKey])

  // Montserrat für die Vorschau laden.
  const [, setFontTick] = useState(0)
  useEffect(() => {
    if (isMontserrat(style.fontFamily)) {
      void prepareMontserrat(style.fontWeight).then(() =>
        setFontTick((t) => t + 1)
      )
    }
  }, [style.fontFamily, style.fontWeight])

  const total = useMemo(
    () => Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0),
    [counts]
  )

  const previewSvg = useMemo(
    () =>
      style.chartType === "bars"
        ? buildBarChartSvg(regions, counts, style)
        : buildMapSvg(regions, viewBox, counts, style),
    [regions, viewBox, counts, style]
  )

  const set = (patch: Partial<MapStyle>) => setStyle((s) => ({ ...s, ...patch }))
  const setCount = (id: string, v: string) => {
    const n = parseInt(v, 10)
    setCounts((c) => ({ ...c, [id]: Number.isFinite(n) && n >= 0 ? n : 0 }))
  }
  const setStateColor = (id: string, color: string | null) =>
    setStyle((s) => {
      const next = { ...s.stateColors }
      if (color) next[id] = color
      else delete next[id]
      return { ...s, stateColors: next }
    })
  const setOffset = (id: string, key: "dx" | "dy", v: string) =>
    setStyle((s) => {
      const cur = s.labelOffsets[id] ?? { dx: 0, dy: 0 }
      const n = parseFloat(v) || 0
      return {
        ...s,
        labelOffsets: { ...s.labelOffsets, [id]: { ...cur, [key]: n } },
      }
    })

  async function exportSvg() {
    try {
      const fontFaceCss = isMontserrat(style.fontFamily)
        ? await prepareMontserrat(style.fontWeight)
        : undefined
      const withFont = { ...style, fontFaceCss }
      const svg =
        style.chartType === "bars"
          ? buildBarChartSvg(regions, counts, withFont)
          : buildMapSvg(regions, viewBox, counts, withFont)
      const base = svgFileName.replace(/\.svg$/i, "")
      const name =
        style.chartType === "bars" ? `${base}-balkendiagramm.svg` : svgFileName
      downloadFile(name, svg, "image/svg+xml")
      toast.success("SVG (Vektor) exportiert")
    } catch (err) {
      toast.error("Export fehlgeschlagen", {
        description: (err as Error).message,
      })
    }
  }

  const q = search.trim().toLowerCase()
  const matchesSearch = (r: RegionGeo) =>
    !q || r.name.toLowerCase().includes(q)
  const inputList = sorted.filter(matchesSearch)
  // Feinjustierung: bei Suche gefilterte, sonst nur „relevante“ (mit Wert/Override).
  const tuneList = searchable
    ? sorted.filter(
        (r) =>
          matchesSearch(r) &&
          (q
            ? true
            : (counts[r.id] ?? 0) > 0 ||
              !!style.stateColors[r.id] ||
              !!style.labelOffsets[r.id])
      )
    : sorted

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="flex flex-col gap-6">
        {/* 1) Eingabemaske */}
        <Card>
          <CardHeader className="gap-2">
            <CardTitle className="text-base">{inputTitle}</CardTitle>
            <CardDescription>
              Anzahl eingeben – Gesamt: <strong>{total}</strong>
            </CardDescription>
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  placeholder={`${regionNoun} suchen …`}
                  className="h-8 pl-8 text-sm"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`grid grid-cols-2 gap-x-3 gap-y-2 ${
                searchable ? "max-h-80 overflow-y-auto pr-1" : ""
              }`}
            >
              {inputList.map((st) => (
                <div key={st.id} className="flex items-center gap-2">
                  <Label
                    className="flex-1 truncate text-xs"
                    htmlFor={`c-${storageKey}-${st.id}`}
                    title={st.name}
                  >
                    {st.name}
                  </Label>
                  <Input
                    id={`c-${storageKey}-${st.id}`}
                    type="number"
                    min={0}
                    value={counts[st.id] ?? ""}
                    placeholder="0"
                    className="h-8 w-16 text-sm"
                    onChange={(e) => setCount(st.id, e.target.value)}
                  />
                </div>
              ))}
              {inputList.length === 0 && (
                <div className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                  Keine Treffer.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2) Darstellung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Darstellung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Row label="Ansicht">
              <select
                className={SELECT_CLS}
                value={style.chartType}
                onChange={(e) =>
                  set({ chartType: e.target.value as MapStyle["chartType"] })
                }
              >
                <option value="map">Karte</option>
                <option value="bars">Balkendiagramm</option>
              </select>
            </Row>
            <Row label="Anzeige">
              <select
                className={SELECT_CLS}
                value={style.valueMode}
                onChange={(e) =>
                  set({ valueMode: e.target.value as MapStyle["valueMode"] })
                }
              >
                <option value="count">Anzahl</option>
                <option value="percent">Prozent</option>
              </select>
            </Row>
            {style.valueMode === "percent" && (
              <Row label="Nachkommastellen">
                <Input
                  type="number"
                  min={0}
                  max={3}
                  value={style.decimals}
                  className="h-8"
                  onChange={(e) =>
                    set({ decimals: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                />
              </Row>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Nullwerte ausblenden</Label>
              <Switch
                checked={style.hideZero}
                onCheckedChange={(v) => set({ hideZero: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Farbabstufung nach Wert</Label>
              <Switch
                checked={style.gradient}
                onCheckedChange={(v) => set({ gradient: v })}
              />
            </div>
            {style.gradient ? (
              <>
                <ColorRow
                  label="Farbe (niedrig)"
                  value={style.gradientLow}
                  onChange={(v) => set({ gradientLow: v })}
                />
                <ColorRow
                  label="Farbe (hoch)"
                  value={style.gradientHigh}
                  onChange={(v) => set({ gradientHigh: v })}
                />
              </>
            ) : (
              <ColorRow
                label={
                  style.chartType === "bars" ? "Balkenfarbe" : "Kartenfarbe"
                }
                value={style.mapColor}
                onChange={(v) => set({ mapColor: v })}
              />
            )}

            {style.chartType === "map" && (
              <>
                <ColorRow
                  label="Rahmen (Innengrenzen)"
                  value={style.borderColor}
                  onChange={(v) => set({ borderColor: v })}
                />
                <Row label="Rahmendicke">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={style.borderWidth}
                    className="h-8"
                    onChange={(e) =>
                      set({
                        borderWidth: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                  />
                </Row>
                <ColorRow
                  label="Außenrand-Farbe"
                  value={style.outlineColor}
                  onChange={(v) => set({ outlineColor: v })}
                />
                <Row label="Außenrand-Dicke (0 = aus)">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={style.outlineWidth}
                    className="h-8"
                    onChange={(e) =>
                      set({
                        outlineWidth: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                  />
                </Row>
              </>
            )}

            {style.chartType === "bars" && (
              <>
                <Row label="Ausrichtung">
                  <select
                    className={SELECT_CLS}
                    value={style.barOrientation}
                    onChange={(e) =>
                      set({
                        barOrientation: e.target
                          .value as MapStyle["barOrientation"],
                      })
                    }
                  >
                    <option value="vertical">Vertikal</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </Row>
                <Row label="Sortierung">
                  <select
                    className={SELECT_CLS}
                    value={style.barSort}
                    onChange={(e) =>
                      set({ barSort: e.target.value as MapStyle["barSort"] })
                    }
                  >
                    <option value="valueDesc">Wert absteigend</option>
                    <option value="valueAsc">Wert aufsteigend</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </Row>
                <Row label="Nur Top-N (0 = alle)">
                  <Input
                    type="number"
                    min={0}
                    value={style.barTopN}
                    className="h-8"
                    onChange={(e) =>
                      set({ barTopN: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                  />
                </Row>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Werteachse zeigen</Label>
                  <Switch
                    checked={style.showValueAxis}
                    onCheckedChange={(v) => set({ showValueAxis: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Kategorieachse (Namen) zeigen</Label>
                  <Switch
                    checked={style.showCategoryAxis}
                    onCheckedChange={(v) => set({ showCategoryAxis: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Gitterlinien</Label>
                  <Switch
                    checked={style.showGrid}
                    onCheckedChange={(v) => set({ showGrid: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Werte an den Balken</Label>
                  <Switch
                    checked={style.showValues}
                    onCheckedChange={(v) => set({ showValues: v })}
                  />
                </div>
                <ColorRow
                  label="Achsenfarbe"
                  value={style.axisColor}
                  onChange={(v) => set({ axisColor: v })}
                />
                {style.showGrid && (
                  <ColorRow
                    label="Gitterfarbe"
                    value={style.gridColor}
                    onChange={(v) => set({ gridColor: v })}
                  />
                )}
              </>
            )}

            <Row label="Rand um die Karte">
              <Input
                type="number"
                min={0}
                value={style.padding}
                className="h-8"
                onChange={(e) =>
                  set({ padding: Math.max(0, parseInt(e.target.value) || 0) })
                }
              />
            </Row>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Hintergrund transparent</Label>
              <Switch
                checked={style.transparent}
                onCheckedChange={(v) => set({ transparent: v })}
              />
            </div>
            {!style.transparent && (
              <ColorRow
                label="Hintergrundfarbe"
                value={style.bgColor}
                onChange={(v) => set({ bgColor: v })}
              />
            )}

            <div className="my-1 h-px bg-border" />

            <Row label="Schrift">
              <select
                className={SELECT_CLS}
                value={style.fontFamily}
                onChange={(e) => set({ fontFamily: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Schriftschnitt">
              <select
                className={SELECT_CLS}
                value={style.fontWeight}
                onChange={(e) => set({ fontWeight: e.target.value })}
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Schriftgröße">
              <Input
                type="number"
                min={2}
                step={0.5}
                value={style.fontSize}
                className="h-8"
                onChange={(e) =>
                  set({ fontSize: Math.max(2, parseFloat(e.target.value) || 0) })
                }
              />
            </Row>
            <ColorRow
              label="Schriftfarbe"
              value={style.fontColor}
              onChange={(v) => set({ fontColor: v })}
            />
          </CardContent>
        </Card>

        {/* 3) Feinjustierung je Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Feinjustierung je {regionNoun}
            </CardTitle>
            <CardDescription>
              Eigene Farbe und Label-Position (dx/dy).
              {searchable && !q
                ? " Es werden nur Länder mit Wert/Anpassung gezeigt – zum Bearbeiten oben suchen."
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            <div className="grid grid-cols-[1fr_46px_56px_56px_28px] items-center gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>{regionNoun}</span>
              <span>Farbe</span>
              <span>dx</span>
              <span>dy</span>
              <span />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {tuneList.map((st) => {
                const off = style.labelOffsets[st.id] ?? { dx: 0, dy: 0 }
                const hasColor = !!style.stateColors[st.id]
                return (
                  <div
                    key={st.id}
                    className="grid grid-cols-[1fr_46px_56px_56px_28px] items-center gap-2 border-b py-1.5 last:border-b-0"
                  >
                    <span className="truncate text-xs" title={st.name}>
                      {st.name}
                    </span>
                    <input
                      type="color"
                      className="h-8 w-full cursor-pointer rounded border bg-transparent"
                      value={style.stateColors[st.id] || style.mapColor}
                      onChange={(e) => setStateColor(st.id, e.target.value)}
                    />
                    <Input
                      type="number"
                      value={off.dx}
                      className="h-8 px-1 text-center text-xs"
                      onChange={(e) => setOffset(st.id, "dx", e.target.value)}
                    />
                    <Input
                      type="number"
                      value={off.dy}
                      className="h-8 px-1 text-center text-xs"
                      onChange={(e) => setOffset(st.id, "dy", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="Farbe zurücksetzen"
                      disabled={!hasColor}
                      onClick={() => setStateColor(st.id, null)}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
              {tuneList.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {searchable && !q
                    ? "Noch keine Werte – oben Anzahl eingeben oder suchen."
                    : "Keine Treffer."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vorschau + Export */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Vorschau</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStyle(defaultStyle)
                toast.success("Darstellung zurückgesetzt")
              }}
            >
              <RotateCcw className="size-4" /> Zurücksetzen
            </Button>
            <Button size="sm" onClick={exportSvg}>
              <Download className="size-4" /> Karte als SVG (Vektor)
            </Button>
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            <div
              className="mx-auto w-full max-w-3xl [&_svg]:h-auto [&_svg]:max-h-[78vh] [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_140px] items-center gap-2">
      <Label className="text-sm">{label}</Label>
      {children}
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
  // "none"/"transparent"/leer = transparent (kein Fill/Stroke).
  const isNone = !value || value === "none" || value === "transparent"
  const last = useRef("#000000")
  if (!isNone) last.current = value
  return (
    <div className="grid grid-cols-[1fr_176px] items-center gap-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          disabled={isNone}
          value={isNone ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border bg-transparent disabled:opacity-40"
        />
        <Input
          value={isNone ? "none" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 flex-1 text-xs"
        />
        <button
          type="button"
          title="Transparent (keine Farbe)"
          onClick={() => onChange(isNone ? last.current : "none")}
          className={`flex size-8 shrink-0 items-center justify-center rounded border ${
            isNone
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Ban className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
