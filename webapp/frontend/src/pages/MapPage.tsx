import { MapEditor } from "@/components/MapEditor"
import { GERMANY_STATES, MAP_VIEWBOX } from "@/lib/germanyMap"
import { DEFAULT_MAP_STYLE } from "@/lib/mapSvg"

export function MapPage() {
  return (
    <MapEditor
      regions={GERMANY_STATES}
      viewBox={MAP_VIEWBOX}
      defaultStyle={DEFAULT_MAP_STYLE}
      storageKey="fnf-map"
      regionNoun="Bundesland"
      inputTitle="Stipendiat*innen je Bundesland"
      svgFileName="deutschland-karte.svg"
    />
  )
}
