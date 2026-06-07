import { MapEditor } from "@/components/MapEditor"
import { DEFAULT_MAP_STYLE, type MapStyle } from "@/lib/mapSvg"
import { WORLD_COUNTRIES, WORLD_VIEWBOX } from "@/lib/worldMap"

// Welt-Defaults: viewBox ist breit & flach -> kleinere Schrift; Nullwerte aus,
// da i. d. R. nur wenige Länder Werte haben; dünner Innenrahmen.
const WORLD_DEFAULT_STYLE: MapStyle = {
  ...DEFAULT_MAP_STYLE,
  hideZero: true,
  fontSize: 11,
  borderColor: "#FFFFFF",
  borderWidth: 0.4,
  outlineColor: "#231F20",
  outlineWidth: 0,
  padding: 8,
  labelOffsets: {},
}

export function WorldMapPage() {
  return (
    <MapEditor
      regions={WORLD_COUNTRIES}
      viewBox={WORLD_VIEWBOX}
      defaultStyle={WORLD_DEFAULT_STYLE}
      storageKey="fnf-world"
      regionNoun="Land"
      inputTitle="Stipendiat*innen je Land"
      svgFileName="weltkarte.svg"
      searchable
    />
  )
}
