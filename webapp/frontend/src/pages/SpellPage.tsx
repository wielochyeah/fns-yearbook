import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  SpellCheck,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
  RotateCcw,
  FileText,
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileDropzone } from "@/components/FileDropzone"

import type { ParsedWorkbook } from "@/lib/excel"
import type { SpellError, SpellResult } from "@/lib/spellcheck"

type Props = {
  file: File | null
  parsed: ParsedWorkbook | null
  busy: boolean
  autoRun?: boolean
  onSelect: (f: File | null) => void
  onLoadSample: () => void
}

const CONTEXT = 60
const IGNORE_KEY = "fnf-spell-ignore"

function loadIgnore(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORE_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* ignore */
  }
  return new Set()
}

function saveIgnore(set: Set<string>) {
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

export function SpellPage({
  file,
  parsed,
  busy,
  autoRun,
  onSelect,
  onLoadSample,
}: Props) {
  const [result, setResult] = useState<SpellResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [ignore, setIgnore] = useState<Set<string>>(() => loadIgnore())
  const [mutedCols, setMutedCols] = useState<Set<string>>(new Set())
  // PDF-Quelle (zusätzlich zu Excel). source bestimmt, was geprüft wird.
  const [pdfPages, setPdfPages] = useState<string[] | null>(null)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [source, setSource] = useState<"excel" | "pdf">("excel")
  const ranRef = useRef(false)

  useEffect(() => {
    saveIgnore(ignore)
  }, [ignore])

  const selectExcel = (f: File | null) => {
    setSource("excel")
    setResult(null) // alte Treffer der vorherigen Quelle nicht stehen lassen
    onSelect(f)
  }
  const loadSampleExcel = () => {
    setSource("excel")
    setResult(null)
    onLoadSample()
  }

  async function onPdf(f: File | null) {
    if (!f) return
    setPdfBusy(true)
    setResult(null)
    try {
      const { extractPdfText } = await import("@/lib/pdfText")
      const pages = await extractPdfText(f)
      setPdfPages(pages)
      setPdfName(f.name)
      setSource("pdf")
      if (!pages.join("").trim()) {
        toast.warning("Im PDF wurde kein Text gefunden", {
          description: "Vermutlich ein gescanntes Bild-PDF (kein Text-Layer).",
        })
      }
    } catch (err) {
      toast.error("PDF konnte nicht gelesen werden", {
        description: (err as Error).message,
      })
    } finally {
      setPdfBusy(false)
    }
  }

  const canCheck = source === "pdf" ? !!pdfPages : !!parsed

  async function runCheck() {
    if (!canCheck) return
    setChecking(true)
    setResult(null)
    setMutedCols(new Set())
    try {
      // kurz warten, damit der Spinner sichtbar wird
      await new Promise((r) => setTimeout(r, 20))
      const spell = await import("@/lib/spellcheck")
      const res =
        source === "pdf" && pdfPages
          ? await spell.checkText(pdfPages, ignore)
          : await spell.checkWorkbook(parsed!, ignore)
      setResult(res)
    } catch (err) {
      console.error("[spellcheck] failed:", err)
      toast.error("Prüfung fehlgeschlagen", {
        description: (err as Error).message,
      })
    } finally {
      setChecking(false)
    }
  }

  // Demo: bei ?demo=spell automatisch einmal prüfen
  useEffect(() => {
    if (autoRun && parsed && !ranRef.current && !checking) {
      ranRef.current = true
      void runCheck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, parsed])

  const filtered = useMemo(() => {
    if (!result) return []
    return result.errors.filter(
      (e) => !ignore.has(e.word.toLowerCase()) && !mutedCols.has(e.column)
    )
  }, [result, ignore, mutedCols])

  const groups = useMemo(() => {
    const map = new Map<number, { name: string | null; errors: SpellError[] }>()
    for (const e of filtered) {
      let g = map.get(e.rowExcel)
      if (!g) {
        g = { name: e.name, errors: [] }
        map.set(e.rowExcel, g)
      }
      g.errors.push(e)
    }
    return [...map.entries()].map(([rowExcel, g]) => ({ rowExcel, ...g }))
  }, [filtered])

  const ignoreWord = (w: string) =>
    setIgnore((prev) => new Set(prev).add(w.toLowerCase()))

  const toggleCol = (col: string) =>
    setMutedCols((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Steuerung */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">1</Badge> Datei (Excel oder PDF)
            </CardTitle>
            <CardDescription>
              Prüft alle Texte auf deutsche Rechtschreibung – komplett im Browser,
              nichts wird hochgeladen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FileDropzone
              file={source === "excel" ? file : null}
              onSelect={selectExcel}
              onLoadSample={loadSampleExcel}
              busy={busy}
            />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> oder PDF
              <span className="h-px flex-1 bg-border" />
            </div>

            <label
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) void onPdf(f)
              }}
            >
              {pdfBusy ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {source === "pdf" && pdfName
                  ? pdfName
                  : "PDF auswählen oder hierher ziehen"}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => onPdf(e.target.files?.[0] ?? null)}
              />
            </label>
            {source === "pdf" && pdfPages && (
              <div className="text-xs text-muted-foreground">
                {pdfPages.length} Seite(n) Text extrahiert
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">2</Badge> Prüfen
            </CardTitle>
            <CardDescription>
              Hunspell (de + en) – englische Wörter und Abkürzungen werden nicht
              als Fehler gewertet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button size="lg" onClick={runCheck} disabled={!canCheck || checking}>
              {checking ? <Loader2 className="animate-spin" /> : <SpellCheck />}
              Rechtschreibung prüfen
            </Button>
            {checking && (
              <p className="text-xs text-muted-foreground">
                Wörterbuch wird (einmalig) geladen, das kann ein paar Sekunden
                dauern…
              </p>
            )}
            {result && !checking && (
              <div className="text-xs text-muted-foreground">
                {result.cellsChecked}{" "}
                {result.unit === "Seite" ? "Seiten" : "Zellen"} ·{" "}
                {result.wordsChecked} Wörter geprüft
              </div>
            )}
            {ignore.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() => setIgnore(new Set())}
              >
                <RotateCcw className="size-3.5" /> {ignore.size} ignorierte Wörter
                zurücksetzen
              </Button>
            )}
          </CardContent>
        </Card>

        {result && result.columns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spalten</CardTitle>
              <CardDescription>Zum Aus-/Einblenden klicken.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {result.columns.map((col) => {
                const active = !mutedCols.has(col)
                const count = result.errors.filter(
                  (e) => e.column === col && !ignore.has(e.word.toLowerCase())
                ).length
                return (
                  <button
                    key={col}
                    onClick={() => toggleCol(col)}
                    title={col}
                    className="block max-w-full"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="flex max-w-full cursor-pointer items-center gap-1"
                    >
                      <span className="min-w-0 truncate">{col}</span>
                      <span className="shrink-0 opacity-70">({count})</span>
                    </Badge>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ergebnisse */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Ergebnisse{" "}
            {filtered.length > 0 && (
              <span className="text-foreground">({filtered.length})</span>
            )}
          </h2>
          {checking && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> prüft…
            </span>
          )}
        </div>
        <Separator />

        {!result ? (
          <Placeholder
            icon={<SpellCheck className="size-10 text-muted-foreground/50" />}
            text={
              canCheck
                ? "Klicke auf „Rechtschreibung prüfen“."
                : "Wähle eine Excel-Datei oder ein PDF (oder lade die Beispieldaten)."
            }
          />
        ) : result.wordsChecked === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
            <AlertTriangle className="size-10 text-amber-500" />
            <div className="max-w-xs text-sm text-muted-foreground">
              Kein prüfbarer Text gefunden
              {result.unit === "Seite"
                ? " – vermutlich ein gescanntes Bild-PDF ohne Text-Layer."
                : "."}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <div className="text-sm text-muted-foreground">
              {result.errors.length === 0
                ? "Keine Rechtschreibfehler gefunden. 🎉"
                : "Keine Treffer mit den aktuellen Filtern."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {result.truncated && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                Sehr viele Treffer – Liste gekürzt. Bitte Spalten filtern.
              </div>
            )}
            {groups.map((g) => (
              <Card key={g.rowExcel} className="gap-0 py-4">
                <CardHeader className="px-4 pb-2">
                  <CardTitle className="text-base">
                    {g.name ?? `${result?.unit ?? "Zeile"} ${g.rowExcel}`}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.name ? `· ${result?.unit ?? "Zeile"} ${g.rowExcel} ` : ""}
                      · {g.errors.length} Treffer
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 px-4">
                  {g.errors.map((e, i) => (
                    <ErrorRow
                      key={`${e.column}-${e.offset}-${i}`}
                      err={e}
                      onIgnore={() => ignoreWord(e.word)}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorRow({ err, onIgnore }: { err: SpellError; onIgnore: () => void }) {
  const start = Math.max(0, err.offset - CONTEXT)
  const end = Math.min(err.text.length, err.offset + err.word.length + CONTEXT)
  const prefix = (start > 0 ? "… " : "") + err.text.slice(start, err.offset)
  const suffix =
    err.text.slice(err.offset + err.word.length, end) +
    (end < err.text.length ? " …" : "")

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {err.column && (
            <Badge
              variant="outline"
              title={err.column}
              className="max-w-[220px] text-[11px] [&>*]:truncate"
            >
              <span className="truncate">{err.column}</span>
            </Badge>
          )}
          <span className="font-mono font-semibold text-rose-600">
            {err.word}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          onClick={onIgnore}
          title="Wort dauerhaft ignorieren"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {err.suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Vorschläge:</span>
          {err.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                navigator.clipboard
                  ?.writeText(s)
                  .then(() => toast.success(`„${s}“ kopiert`))
                  .catch(() => toast.error("Kopieren nicht möglich"))
              }}
            >
              <Badge variant="secondary" className="cursor-pointer">
                {s}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {prefix}
        <mark className="rounded-sm bg-rose-100 px-0.5 font-medium text-rose-700">
          {err.word}
        </mark>
        {suffix}
      </div>
    </div>
  )
}

function Placeholder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
      {icon}
      <div className="max-w-xs text-sm text-muted-foreground">{text}</div>
    </div>
  )
}
