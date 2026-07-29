import { Polygon, Tooltip } from 'react-leaflet'
import { MUNICIPALITY_BOUNDS } from '../../lib/philippineLocations'

export function MunicipalBoundaryLayer() {
  return (
    <>
      {MUNICIPALITY_BOUNDS.map(m => (
        <Polygon
          key={m.psgc10}
          positions={m.coords}
          pathOptions={{
            color: '#ef4444',
            weight: 1.5,
            dashArray: '7, 5',
            fillOpacity: 0,
            opacity: 0.75,
          }}
        >
          <Tooltip sticky>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              <p style={{ fontWeight: 700, margin: 0 }}>{m.name}</p>
              <p style={{ margin: 0, color: '#6b7280' }}>PSGC: {m.psgc10}</p>
              <p style={{ margin: 0, color: '#6b7280' }}>Code: {m.code}</p>
            </div>
          </Tooltip>
        </Polygon>
      ))}
    </>
  )
}
