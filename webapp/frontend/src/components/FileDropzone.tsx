import { useRef, useState } from "react"
import { Upload, FileSpreadsheet } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  file: File | null
  onSelect: (f: File | null) => void
  onLoadSample: () => void
  busy?: boolean
}

export function FileDropzone({ file, onSelect, onLoadSample, busy }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onSelect(e.dataTransfer.files?.[0] ?? null)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-accent"
            : "hover:border-primary/50 hover:bg-accent/50"
        }`}
      >
        <Upload className="size-6 text-muted-foreground" />
        <div className="text-sm font-medium">
          Datei hierher ziehen oder klicken
        </div>
        <div className="text-xs text-muted-foreground">.xlsx</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      {file && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onLoadSample}
        disabled={busy}
      >
        Beispieldaten laden
      </Button>
    </div>
  )
}
