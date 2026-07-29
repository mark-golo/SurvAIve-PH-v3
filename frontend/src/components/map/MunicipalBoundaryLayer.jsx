import { GeoJSON } from 'react-leaflet'
import boundaryData from '../../data/municipality-boundaries.json'

const boundaryStyle = {
  color: '#ef4444',
  weight: 1.5,
  dashArray: '7, 5',
  fillOpacity: 0,
  opacity: 0.75,
}

function onEachFeature(feature, layer) {
  const { name, psgc10, code } = feature.properties
  layer.bindTooltip(
    `<div style="font-size:11px;line-height:1.5">
      <b>${name}</b><br>
      PSGC: ${psgc10}<br>
      Code: ${code}
    </div>`,
    { sticky: true }
  )
}

export function MunicipalBoundaryLayer() {
  return (
    <GeoJSON
      key="municipal-boundaries"
      data={boundaryData}
      style={boundaryStyle}
      onEachFeature={onEachFeature}
    />
  )
}
