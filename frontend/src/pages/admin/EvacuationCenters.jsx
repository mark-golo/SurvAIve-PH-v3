import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Plus, Pencil, Trash2, Search, Tent } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { getBarangays } from '../../lib/philippineLocations'
import { useAuthStore } from '../../store/auth'

const DEMO = [
  { id: 1, name: 'Del Carmen Municipal Gymnasium',   province: 'Surigao del Norte', municipality: 'Del Carmen', barangay: 'Del Carmen Poblacion', address: 'Del Carmen Poblacion, Del Carmen, Siargao Island', lat: 9.8520, lng: 126.0730, capacity: 500, contact_number: '09170001001', status: 'open' },
  { id: 2, name: 'Bitoon Barangay Hall',              province: 'Surigao del Norte', municipality: 'Del Carmen', barangay: 'Bitoon',    address: 'Bitoon, Del Carmen, Siargao Island',    lat: 9.8715, lng: 126.0685, capacity: 150, contact_number: '09170001002', status: 'open' },
  { id: 3, name: 'Siargao Island Sports Complex',    province: 'Surigao del Norte', municipality: 'Del Carmen', barangay: 'San Jose',     address: 'San Jose, Del Carmen, Siargao Island',     lat: 9.8485, lng: 126.0845, capacity: 800, contact_number: '09170001003', status: 'open' },
]

const BLANK = { name: '', province: '', municipality: '', barangay: '', address: '', lat: '', lng: '', capacity: '', contact_number: '', status: 'open' }

const shelterIcon = (status, selected) => {
  const color = status === 'open' ? '#22c55e' : status === 'full' ? '#f59e0b' : '#9ca3af'
  const border = selected ? '3px solid #fbbf24' : `2px solid white`
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:${color};border:${border};border-radius:6px;
           display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${color};font-size:12px">⛺</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  })
}

const STATUS_COLORS = {
  open:   { bg: 'bg-[rgba(34,197,94,0.1)]',   text: 'text-[#22c55e]',  label: 'Open'   },
  full:   { bg: 'bg-[rgba(245,158,11,0.1)]',  text: 'text-[#f59e0b]',  label: 'Full'   },
  closed: { bg: 'bg-[rgba(107,114,128,0.1)]', text: 'text-[#9ca3af]',  label: 'Closed' },
}

export function EvacuationCenters() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const prov = scope?.province

  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setData(rows))
      .catch(() => setData(DEMO))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const summary = {
    total:  data.length,
    open:   data.filter(r => r.status === 'open').length,
    full:   data.filter(r => r.status === 'full').length,
    closed: data.filter(r => r.status === 'closed').length,
  }

  function openAdd() {
    setEditId(null)
    setForm({ ...BLANK, province: prov ?? '', municipality: muni ?? '' })
    setError(''); setShowAdd(true)
  }

  function openEdit(row) {
    setShowAdd(false)
    setEditId(row.id)
    setForm({
      name: row.name, province: row.province ?? '', municipality: row.municipality ?? '',
      barangay: row.barangay ?? '', address: row.address ?? '',
      lat: row.lat ?? '', lng: row.lng ?? '',
      capacity: row.capacity ?? '', contact_number: row.contact_number ?? '', status: row.status,
    })
    setError('')
  }

  function closeForm() { setShowAdd(false); setEditId(null); setError('') }

  async function handleSave() {
    if (!form.name.trim())  { setError('Name is required'); return }
    if (!form.lat || !form.lng) { setError('Latitude and longitude are required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), capacity: form.capacity ? parseInt(form.capacity) : null }
      if (showAdd) {
        const res = await api.post('/evacuation_centers', payload)
        setData(prev => [...prev, { ...payload, id: res.id }])
      } else {
        await api.put(`/evacuation_centers/${editId}`, payload)
        setData(prev => prev.map(r => r.id === editId ? { ...r, ...payload } : r))
      }
      closeForm()
    } catch (e) {
      setError(e?.error ?? e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Remove "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/evacuation_centers/${row.id}`)
      setData(prev => prev.filter(r => r.id !== row.id))
      if (selectedId === row.id) setSelectedId(null)
    } catch { alert('Delete failed') }
  }

  const mapCenter = data.length
    ? [data.reduce((s, c) => s + Number(c.lat), 0) / data.length, data.reduce((s, c) => s + Number(c.lng), 0) / data.length]
    : [9.852, 126.073]

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <AdminLayout title="Evacuation Centers">
      <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

        {/* Map strip */}
        <div className="h-[260px] shrink-0 border-b border-[rgba(255,255,255,0.08)]">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', background: '#0a1628' }} zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {data.filter(c => c.lat && c.lng).map(c => (
              <Marker key={c.id} position={[Number(c.lat), Number(c.lng)]} icon={shelterIcon(c.status, c.id === selectedId)}
                eventHandlers={{ click: () => setSelectedId(c.id) }}>
                <Popup>
                  <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[170px]">
                    <p className="font-bold text-[#22c55e] mb-1">⛺ {c.name}</p>
                    <p className="text-slate-400 mb-0.5">Brgy. {c.barangay}</p>
                    {c.capacity && <p className="text-slate-400 mb-0.5">Capacity: {c.capacity}</p>}
                    {c.contact_number && <p className="text-slate-400">{c.contact_number}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* CRUD section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary chips */}
          <div className="grid grid-cols-4 gap-3">
            <Chip label="Total"  value={summary.total}  color="#00d4ff" />
            <Chip label="Open"   value={summary.open}   color="#22c55e" />
            <Chip label="Full"   value={summary.full}   color="#f59e0b" />
            <Chip label="Closed" value={summary.closed} color="#9ca3af" />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <GlassInput placeholder="Search name or barangay…" icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <NeonButton size="sm" onClick={openAdd}>
              <Plus size={13} className="mr-1.5" />
              Add Center
            </NeonButton>
          </div>

          {/* Add form */}
          {showAdd && <CenterForm title="New Evacuation Center" form={form} set={set} error={error} saving={saving} onSave={handleSave} onCancel={closeForm} isEdit={false} />}

          {/* Table */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {['Name', 'Barangay', 'Address', 'Capacity', 'Contact', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
                    : filtered.length === 0
                      ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No evacuation centers found</td></tr>
                      : filtered.map(row => {
                          const sc = STATUS_COLORS[row.status] ?? STATUS_COLORS.closed
                          return (
                            <>
                              <tr key={row.id}
                                onClick={() => setSelectedId(row.id)}
                                className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer ${selectedId === row.id ? 'bg-[rgba(34,197,94,0.05)]' : ''}`}>
                                <td className="px-4 py-3 text-sm font-medium text-white">
                                  <div className="flex items-center gap-2"><Tent size={13} className="text-[#22c55e]" />{row.name}</div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.barangay ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px] truncate">{row.address ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-300">{row.capacity ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.contact_number ?? '—'}</td>
                                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button onClick={e => { e.stopPropagation(); openEdit(row) }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors">
                                      <Pencil size={13} />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(row) }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {editId === row.id && (
                                <tr key={`edit-${row.id}`} className="bg-[rgba(34,197,94,0.03)]">
                                  <td colSpan={7} className="px-4 py-3">
                                    <CenterForm title={`Edit — ${row.name}`} form={form} set={set} error={error} saving={saving} onSave={handleSave} onCancel={closeForm} isEdit />
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })
                  }
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-600 text-right">{filtered.length} of {data.length} centers</p>
        </div>
      </div>
    </AdminLayout>
  )
}

function CenterForm({ title, form, set, error, saving, onSave, onCancel, isEdit }) {
  return (
    <GlassCard>
      <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <GlassInput label="Name *"         value={form.name}           onChange={e => set('name', e.target.value)}           placeholder="Del Carmen Gymnasium" />
        <GlassInput label="Province"       value={form.province}       onChange={e => set('province', e.target.value)}       placeholder="Surigao del Norte" />
        <GlassInput label="Municipality"   value={form.municipality}   onChange={e => set('municipality', e.target.value)}   placeholder="Del Carmen" />
        <GlassSelect label="Barangay" value={form.barangay} onChange={e => set('barangay', e.target.value)}>
          <option value="">Select Barangay</option>
          {getBarangays(form.municipality).map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </GlassSelect>
        <GlassInput label="Address"        value={form.address}        onChange={e => set('address', e.target.value)}        placeholder="Del Carmen Poblacion, Del Carmen" />
        <GlassInput label="Capacity"       value={form.capacity}       onChange={e => set('capacity', e.target.value)}       placeholder="500" type="number" />
        <GlassInput label="Latitude *"     value={form.lat}            onChange={e => set('lat', e.target.value)}            placeholder="9.8520" type="number" />
        <GlassInput label="Longitude *"    value={form.lng}            onChange={e => set('lng', e.target.value)}            placeholder="126.0730" type="number" />
        <GlassInput label="Contact Number" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
        <GlassSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="open">Open</option>
          <option value="full">Full</option>
          <option value="closed">Closed</option>
        </GlassSelect>
      </div>
      {error && <p className="text-xs text-[#ef4444] mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <NeonButton size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</NeonButton>
        <NeonButton variant="ghost" size="sm" onClick={onCancel}>Cancel</NeonButton>
      </div>
    </GlassCard>
  )
}

function Chip({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}
