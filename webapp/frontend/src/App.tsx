import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { BarChart3, SpellCheck, Map as MapIcon, Globe } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { ChartsPage } from "@/pages/ChartsPage"
import { SpellPage } from "@/pages/SpellPage"
import { MapPage } from "@/pages/MapPage"
import { parseFile, type ParsedWorkbook } from "@/lib/excel"
import fnfLogo from "@/assets/fnf-logo.svg"

// Weltkarte enthält große Geodaten -> erst beim Öffnen laden (eigener Chunk).
const WorldMapPage = lazy(() =>
  import("@/pages/WorldMapPage").then((m) => ({ default: m.WorldMapPage }))
)

type Page = "charts" | "spell" | "map" | "world"

const demoParam = new URLSearchParams(window.location.search).get("demo")

function App() {
  const [page, setPage] = useState<Page>(
    demoParam === "spell" ? "spell" : "charts"
  )
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [parsing, setParsing] = useState(false)

  const selectFile = useCallback(async (f: File | null) => {
    if (!f) return
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      toast.error("Bitte eine .xlsx-Datei wählen.")
      return
    }
    setFile(f)
    setParsing(true)
    try {
      const data = await parseFile(f)
      setParsed(data)
    } catch (err) {
      setParsed(null)
      toast.error("Excel konnte nicht gelesen werden", {
        description: (err as Error).message,
      })
    } finally {
      setParsing(false)
    }
  }, [])

  const loadSample = useCallback(async () => {
    setParsing(true)
    try {
      const res = await fetch("/beispiel.xlsx")
      if (!res.ok) throw new Error("Beispiel nicht gefunden")
      const blob = await res.blob()
      const f = new File([blob], "beispiel.xlsx", { type: blob.type })
      setFile(f)
      const data = await parseFile(f)
      setParsed(data)
      toast.success("Beispieldaten geladen")
    } catch (err) {
      toast.error("Beispiel laden fehlgeschlagen", {
        description: (err as Error).message,
      })
    } finally {
      setParsing(false)
    }
  }, [])

  // Optional: ?demo=1 lädt Beispieldaten, ?demo=spell zusätzlich mit
  // automatischer Rechtschreibprüfung (für Demo/Screenshots).
  const demo = demoParam
  useEffect(() => {
    // Auto-Load der Beispieldaten beim Mounten ist hier gewollt (Demo-Deeplink).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (demo === "1" || demo === "spell") void loadSample()
  }, [demo, loadSample])

  const pageProps = {
    file,
    parsed,
    busy: parsing,
    onSelect: selectFile,
    onLoadSample: loadSample,
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />

      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={fnfLogo}
              alt="Friedrich Naumann Foundation"
              className="h-9 w-auto"
            />
            <div className="h-9 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                FNF-Jahrbuch
              </h1>
              <p className="text-xs text-muted-foreground">
                Slider-Charts, Steckbriefe, Rechtschreibprüfung, Deutschland- &amp;
                Weltkarte
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <Button
              variant={page === "charts" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPage("charts")}
            >
              <BarChart3 /> Charts
            </Button>
            <Button
              variant={page === "spell" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPage("spell")}
            >
              <SpellCheck /> Rechtschreibprüfung
            </Button>
            <Button
              variant={page === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPage("map")}
            >
              <MapIcon /> Deutschland-Karte
            </Button>
            <Button
              variant={page === "world" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPage("world")}
            >
              <Globe /> Weltkarte
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {page === "charts" ? (
          <ChartsPage {...pageProps} />
        ) : page === "spell" ? (
          <SpellPage {...pageProps} autoRun={demo === "spell"} />
        ) : page === "map" ? (
          <MapPage />
        ) : (
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-muted-foreground">
                Weltkarte wird geladen …
              </div>
            }
          >
            <WorldMapPage />
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default App
