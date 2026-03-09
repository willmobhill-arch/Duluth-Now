import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Zoning Map' }

// Map is rendered client-side; this is a thin shell
export default function MapPage() {
  return (
    <div className="h-[calc(100vh-56px)] bg-[#0C1F3F] flex items-center justify-center">
      <div className="text-center text-white/60">
        <p className="font-mono text-sm mb-2">Zoning Map</p>
        <p className="text-xs">Mapbox integration — Phase 2</p>
      </div>
    </div>
  )
}
