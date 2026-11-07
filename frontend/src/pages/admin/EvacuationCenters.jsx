import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  LayoutDashboard, Building2, Shield, Users, Brain, BarChart2, History,
  Plus, Pencil, Trash2, Search, RefreshCw, Tent, CheckCircle, AlertTriangle,
  XCircle, Clock, HelpCircle, Package, ChevronDown, ChevronUp,
  UserPlus, UserMinus, Camera, QrCode, X, AlertCircle,
} from 'lucide-react'

import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/api'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'
import { useAuthStore } from '../../store/auth'

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'Overview',              icon: LayoutDashboard },
  { id: 'centers',    label: 'Evacuation Centers',     icon: Building2 },
  { id: 'assessment', label: 'Safety Assessment',      icon: Shield },
  { id: 'occupancy',  label: 'Occupancy & Resources',  icon: Users },
  { id: 'insights',   label: 'AI Insights',            icon: Brain },
  { id: 'comparison', label: 'Center Comparison',      icon: BarChart2 },
  { id: 'history',    label: 'Evacuation History',     icon: History },
]

// ── Status config ──────────────────────────────────────────────────────────────
const OVERALL_CFG = {
  'Safe':              { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: CheckCircle  },
  'At Risk':           { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: AlertTriangle },
  'Unsafe':            { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle       },
  'Full':              { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: Users         },
  'Under Maintenance': { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)',  icon: Clock         },
  'Unverified':        { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: HelpCircle    },
}
const STATUS_COLORS = {
  open:   { bg: 'bg-[rgba(34,197,94,0.1)]',   text: 'text-[#22c55e]',  label: 'Open'   },
  full:   { bg: 'bg-[rgba(245,158,11,0.1)]',  text: 'text-[#f59e0b]',  label: 'Full'   },
  closed: { bg: 'bg-[rgba(107,114,128,0.1)]', text: 'text-[#9ca3af]',  label: 'Closed' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function computeOverall(safety, operational, occupancy, maxCapacity, accessibility) {
  if (safety === 'Unsafe') return 'Unsafe'
  if (operational === 'Maintenance' || operational === 'Unavailable') return 'Under Maintenance'
  if (maxCapacity > 0 && occupancy >= maxCapacity) return 'Full'
  if (safety === 'Unverified' || accessibility === 'Unverified') return 'Unverified'
  if (safety === 'At Risk' || accessibility === 'Limited') return 'At Risk'
  if (safety === 'Safe' && operational === 'Operational') return 'Safe'
  return 'Unverified'
}

function computeRecommendationScore(center, victimPos, allCenters) {
  const safetyMap  = { Safe: 100, 'At Risk': 50, Unverified: 25, Unsafe: 0 }
  const accessMap  = { Accessible: 100, Limited: 50, Unverified: 25, Inaccessible: 0 }
  const Sa  = safetyMap[center.safety_status] ?? 25
  const Ac  = accessMap[center.accessibility_status] ?? 25
  const avail = Math.max(0, (center.capacity ?? 0) - (center.current_occupancy ?? 0))
  const C   = center.capacity > 0 ? (avail / center.capacity) * 100 : 0
  const dists = allCenters.filter(c => c.lat && c.lng).map(c => haversine(victimPos[0], victimPos[1], Number(c.lat), Number(c.lng)))
  const maxDist = Math.max(...dists, 1)
  const dist = haversine(victimPos[0], victimPos[1], Number(center.lat), Number(center.lng))
  const D   = 100 - Math.min(100, (dist / maxDist) * 100)
  return (Sa * 0.35) + (C * 0.25) + (Ac * 0.20) + (D * 0.15)
}

function generateExplanation(center, distKm) {
  const reasons = []
  if (center.safety_status === 'Safe') reasons.push('classified as Safe')
  else if (center.safety_status === 'At Risk') reasons.push('classified as At Risk — verify before proceeding')
  else reasons.push(`safety status: ${center.safety_status}`)
  if (center.operational_status === 'Operational') reasons.push('currently operational')
  const avail = Math.max(0, (center.capacity ?? 0) - (center.current_occupancy ?? 0))
  reasons.push(`${avail} available spaces (${center.current_occupancy ?? 0}/${center.capacity ?? 0} occupied)`)
  if (center.accessibility_status === 'Accessible') reasons.push('accessible route from the specified location')
  return `Recommended: ${center.name} — ${reasons.join(', ')}. Distance: ${distKm.toFixed(1)} km. Highest-ranked eligible destination based on latest assessment.`
}

function computeForecast(center, projected) {
  const cap = center.capacity ?? 0
  const curr = center.current_occupancy ?? 0
  const projOccupancy  = curr + projected
  const projRemaining  = cap - projOccupancy
  let status
  if (cap === 0) {
    status = 'Unknown'
  } else if (projRemaining >= cap * 0.1) {
    status = 'Can Accommodate'
  } else if (projRemaining > 0) {
    status = 'Near Capacity'
  } else {
    status = 'Exceeds Capacity'
  }
  return { projOccupancy, projRemaining, status, cap, curr, projected }
}

// ── Leaflet icon ───────────────────────────────────────────────────────────────
const shelterIcon = (overallStatus, selected) => {
  const cfg = OVERALL_CFG[overallStatus] ?? OVERALL_CFG['Unverified']
  const border = selected ? '3px solid #fbbf24' : `2px solid rgba(255,255,255,0.4)`
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:${cfg.color};border:${border};border-radius:6px;
           display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${cfg.color};font-size:12px">⛺</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  })
}

// ── Blank form shapes ──────────────────────────────────────────────────────────
const BLANK = { name: '', province: '', municipality: '', barangay: '', address: '', lat: '', lng: '',
  capacity: '', current_occupancy: 0, contact_number: '', status: 'open',
  safety_status: 'Unverified', operational_status: 'Operational', accessibility_status: 'Unverified' }
const BLANK_ASSESS = { safety_status: 'Unverified', operational_status: 'Operational', accessibility_status: 'Unverified', hazard_report: '', assessment_source: '' }
const BLANK_RESOURCE = { resource_name: '', quantity_available: '', unit: 'units', availability_status: 'Available' }
const BLANK_HISTORY = { center_id: '', event_name: '', event_date: '', total_evacuees: '', maximum_occupancy: '', previous_occupancy: 0 }

// ── Badge helpers ──────────────────────────────────────────────────────────────
function OverallBadge({ status }) {
  const cfg = OVERALL_CFG[status] ?? OVERALL_CFG['Unverified']
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {status}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main component
// ══════════════════════════════════════════════════════════════════════════════
export function EvacuationCenters() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const prov = scope?.province

  // ── Core data ──────────────────────────────────────────────────────────────
  const [tab, setTab]       = useState('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)

  const loadCenters = useCallback(() => {
    setLoading(true)
    api.get(muni ? `/evacuation_centers?municipality=${encodeURIComponent(muni)}` : '/evacuation_centers')
      .then(rows => setData(Array.isArray(rows) ? rows : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [muni])

  useEffect(() => { loadCenters() }, [loadCenters])

  async function handleRefresh() {
    setRefreshing(true)
    loadCenters()
    if (tab === 'assessment' && assessCenterId) {
      api.get(`/evacuation_center_assessments?center_id=${assessCenterId}`)
        .then(rows => setAssessments(Array.isArray(rows) ? rows : [])).catch(() => {})
    }
    if (tab === 'occupancy' && occCenterId) {
      api.get(`/evacuation_center_resources?center_id=${occCenterId}`)
        .then(rows => setResources(Array.isArray(rows) ? rows : [])).catch(() => {})
      api.get(`/evacuation_center_occupancy_events?center_id=${occCenterId}`)
        .then(rows => setRecentEvents(Array.isArray(rows) ? rows.slice(0, 10) : [])).catch(() => {})
    }
    setTimeout(() => setRefreshing(false), 800)
  }

  // ── Centers tab ────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [barangayFilter, setBFilter]  = useState('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(BLANK)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [selectedId, setSelectedId]   = useState(null)

  const filtered = data.filter(r => {
    if (barangayFilter !== 'all' && r.barangay !== barangayFilter) return false
    if (!search) return true
    return r.name.toLowerCase().includes(search.toLowerCase()) ||
           (r.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  })

  function openAdd() {
    setEditId(null); setForm({ ...BLANK, province: prov ?? '', municipality: muni ?? '' })
    setFormError(''); setShowAdd(true)
  }
  function openEdit(row) {
    setShowAdd(false); setEditId(row.id)
    setForm({ name: row.name, province: row.province ?? '', municipality: row.municipality ?? '',
      barangay: row.barangay ?? '', address: row.address ?? '', lat: row.lat ?? '', lng: row.lng ?? '',
      capacity: row.capacity ?? '', current_occupancy: row.current_occupancy ?? 0, contact_number: row.contact_number ?? '',
      status: row.status, safety_status: row.safety_status ?? 'Unverified',
      operational_status: row.operational_status ?? 'Operational', accessibility_status: row.accessibility_status ?? 'Unverified',
    })
    setFormError('')
  }
  function closeForm() { setShowAdd(false); setEditId(null); setFormError('') }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.lat || !form.lng) { setFormError('Latitude and longitude are required'); return }
    setSaving(true); setFormError('')
    try {
      const payload = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng),
        capacity: form.capacity ? parseInt(form.capacity) : null,
        current_occupancy: parseInt(form.current_occupancy) || 0,
        overall_status: computeOverall(form.safety_status, form.operational_status,
          parseInt(form.current_occupancy) || 0, parseInt(form.capacity) || 0, form.accessibility_status),
      }
      if (showAdd) {
        const res = await api.post('/evacuation_centers', payload)
        setData(prev => [...prev, { ...payload, id: res.id }])
      } else {
        await api.put(`/evacuation_centers/${editId}`, payload)
        setData(prev => prev.map(r => r.id === editId ? { ...r, ...payload } : r))
      }
      closeForm()
    } catch (e) { setFormError(e?.error ?? e?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Remove "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/evacuation_centers/${row.id}`)
      setData(prev => prev.filter(r => r.id !== row.id))
      if (selectedId === row.id) setSelectedId(null)
    } catch { alert('Delete failed') }
  }

  // ── Assessment tab ─────────────────────────────────────────────────────────
  const [assessCenterId, setAssessCenterId] = useState('')
  const [assessments, setAssessments]       = useState([])
  const [assessForm, setAssessForm]         = useState(BLANK_ASSESS)
  const [assessSaving, setAssessSaving]     = useState(false)
  const [assessError, setAssessError]       = useState('')

  useEffect(() => {
    if (tab === 'assessment' && assessCenterId) {
      api.get(`/evacuation_center_assessments?center_id=${assessCenterId}`)
        .then(rows => setAssessments(Array.isArray(rows) ? rows : []))
        .catch(() => setAssessments([]))
    }
  }, [tab, assessCenterId])

  async function saveAssessment() {
    if (!assessCenterId) { setAssessError('Select a center first'); return }
    setAssessSaving(true); setAssessError('')
    try {
      const center = data.find(c => String(c.id) === String(assessCenterId))
      const overall = computeOverall(assessForm.safety_status, assessForm.operational_status,
        center?.current_occupancy ?? 0, center?.capacity ?? 0, assessForm.accessibility_status)
      await api.post('/evacuation_center_assessments', {
        center_id: assessCenterId,
        ...assessForm,
        assessment_result: overall,
        verified_at: new Date().toISOString(),
      })
      await api.put(`/evacuation_centers/${assessCenterId}`, {
        safety_status: assessForm.safety_status,
        operational_status: assessForm.operational_status,
        accessibility_status: assessForm.accessibility_status,
        overall_status: overall,
        last_verified_at: new Date().toISOString(),
      })
      setData(prev => prev.map(c => String(c.id) === String(assessCenterId)
        ? { ...c, safety_status: assessForm.safety_status, operational_status: assessForm.operational_status,
            accessibility_status: assessForm.accessibility_status, overall_status: overall,
            last_verified_at: new Date().toISOString() }
        : c))
      const rows = await api.get(`/evacuation_center_assessments?center_id=${assessCenterId}`)
      setAssessments(Array.isArray(rows) ? rows : [])
      setAssessForm(BLANK_ASSESS)
    } catch (e) { setAssessError(e?.error ?? e?.message ?? 'Save failed') }
    finally { setAssessSaving(false) }
  }

  // ── Occupancy & Resources tab ──────────────────────────────────────────────
  const [occCenterId, setOccCenterId]       = useState('')
  const [resources, setResources]           = useState([])
  const [newOccupancy, setNewOccupancy]     = useState('')
  const [occSaving, setOccSaving]           = useState(false)
  const [resourceForm, setResourceForm]     = useState(BLANK_RESOURCE)
  const [editResId, setEditResId]           = useState(null)
  const [resSaving, setResSaving]           = useState(false)

  // ── QR check-in / check-out ────────────────────────────────────────────────
  const [arrivedOpen, setArrivedOpen]       = useState(false)
  const [departedOpen, setDepartedOpen]     = useState(false)
  const [checkScannerMode, setCheckScannerMode] = useState(false)
  const [checkEvacueeRef, setCheckEvacueeRef]   = useState('')
  const [checkEvacueeName, setCheckEvacueeName] = useState('')
  const [checkGroupSize, setCheckGroupSize]     = useState(1)
  const [checkSaving, setCheckSaving]           = useState(false)
  const [checkError, setCheckError]             = useState('')
  const [recentEvents, setRecentEvents]         = useState([])

  useEffect(() => {
    if (tab === 'occupancy' && occCenterId) {
      api.get(`/evacuation_center_resources?center_id=${occCenterId}`)
        .then(rows => setResources(Array.isArray(rows) ? rows : []))
        .catch(() => setResources([]))
      api.get(`/evacuation_center_occupancy_events?center_id=${occCenterId}`)
        .then(rows => setRecentEvents(Array.isArray(rows) ? rows.slice(0, 10) : []))
        .catch(() => setRecentEvents([]))
    }
  }, [tab, occCenterId])

  const occCenter = data.find(c => String(c.id) === String(occCenterId))

  async function saveOccupancy() {
    if (!occCenterId || newOccupancy === '') return
    const val = parseInt(newOccupancy)
    if (isNaN(val) || val < 0) return
    const cap = occCenter?.capacity ?? 0
    if (cap > 0 && val > cap && !window.confirm(`Occupancy (${val}) exceeds capacity (${cap}). Continue?`)) return
    setOccSaving(true)
    try {
      const prev = occCenter?.current_occupancy ?? 0
      const avail = Math.max(0, cap - val)
      const overall = computeOverall(occCenter?.safety_status ?? 'Unverified',
        occCenter?.operational_status ?? 'Operational', val, cap, occCenter?.accessibility_status ?? 'Unverified')
      await api.put(`/evacuation_centers/${occCenterId}`, { current_occupancy: val, overall_status: overall })
      await api.post('/evacuation_occupancy_logs', {
        center_id: occCenterId, previous_occupancy: prev, updated_occupancy: val,
        maximum_capacity: cap, available_spaces: avail, updated_by_role: 'admin',
      })
      setData(prev2 => prev2.map(c => String(c.id) === String(occCenterId)
        ? { ...c, current_occupancy: val, overall_status: overall } : c))
      setNewOccupancy('')
    } catch (e) { alert(e?.error ?? 'Update failed') }
    finally { setOccSaving(false) }
  }

  async function saveResource() {
    if (!occCenterId || !resourceForm.resource_name) return
    setResSaving(true)
    try {
      if (editResId) {
        await api.put(`/evacuation_center_resources/${editResId}`, resourceForm)
        setResources(prev => prev.map(r => r.id === editResId ? { ...r, ...resourceForm } : r))
      } else {
        const res = await api.post('/evacuation_center_resources', { center_id: occCenterId, ...resourceForm })
        setResources(prev => [...prev, { id: res.id, center_id: occCenterId, ...resourceForm }])
      }
      setResourceForm(BLANK_RESOURCE); setEditResId(null)
    } catch (e) { alert(e?.error ?? 'Save failed') }
    finally { setResSaving(false) }
  }

  async function deleteResource(id) {
    if (!window.confirm('Remove this resource?')) return
    await api.delete(`/evacuation_center_resources/${id}`).catch(() => {})
    setResources(prev => prev.filter(r => r.id !== id))
  }

  function loadRecentEvents() {
    if (!occCenterId) return
    api.get(`/evacuation_center_occupancy_events?center_id=${occCenterId}`)
      .then(rows => setRecentEvents(Array.isArray(rows) ? rows.slice(0, 10) : []))
      .catch(() => setRecentEvents([]))
  }

  function resetCheckForm() {
    setCheckEvacueeRef(''); setCheckEvacueeName(''); setCheckGroupSize(1); setCheckError(''); setCheckScannerMode(false)
  }

  async function recordArrival() {
    if (!occCenterId) { setCheckError('Select a center first'); return }
    setCheckSaving(true); setCheckError('')
    try {
      await api.post('/evacuation_center_checkins', {
        center_id: occCenterId,
        evacuee_id: checkEvacueeRef || null,
        evacuee_name: checkEvacueeName || null,
        group_size: checkGroupSize,
        checked_in_by: 'admin',
      })
      loadCenters(); loadRecentEvents()
      setArrivedOpen(false); resetCheckForm()
    } catch (e) { setCheckError(e?.error ?? 'Failed to record arrival') }
    finally { setCheckSaving(false) }
  }

  async function recordDeparture() {
    if (!occCenterId) { setCheckError('Select a center first'); return }
    setCheckSaving(true); setCheckError('')
    try {
      await api.post('/evacuation_center_checkouts', {
        center_id: occCenterId,
        evacuee_id: checkEvacueeRef || null,
        evacuee_name: checkEvacueeName || null,
        group_size: checkGroupSize,
        checked_out_by: 'admin',
      })
      loadCenters(); loadRecentEvents()
      setDepartedOpen(false); resetCheckForm()
    } catch (e) { setCheckError(e?.error ?? 'Failed to record departure') }
    finally { setCheckSaving(false) }
  }

  // ── AI Insights tab ────────────────────────────────────────────────────────
  const [recLat, setRecLat]             = useState('')
  const [recLng, setRecLng]             = useState('')
  const [recommendation, setRec]        = useState(null)
  const [recError, setRecError]         = useState('')
  const [forecastCenterId, setFcId]     = useState('')
  const [forecastIncoming, setFcIn]     = useState('')
  const [forecastResult, setFcResult]   = useState(null)
  const [forecastSaving, setFcSaving]   = useState(false)

  function runRecommendation() {
    const lat = parseFloat(recLat); const lng = parseFloat(recLng)
    if (isNaN(lat) || isNaN(lng)) { setRecError('Enter valid latitude and longitude'); return }
    setRecError('')
    const eligible = data.filter(c => c.lat && c.lng &&
      !['Unsafe', 'Under Maintenance', 'Full'].includes(c.overall_status) &&
      c.accessibility_status !== 'Inaccessible')
    const scored = eligible.map(c => ({
      ...c,
      distKm: haversine(lat, lng, Number(c.lat), Number(c.lng)),
      score: computeRecommendationScore(c, [lat, lng], data),
    })).sort((a, b) => b.score - a.score)
    if (scored.length === 0) { setRecError('No suitable centers found for this location.'); setRec(null); return }
    setRec({ top: scored[0], alternatives: scored.slice(1, 4) })
  }

  async function saveForecast() {
    if (!forecastCenterId || forecastIncoming === '') return
    const center = data.find(c => String(c.id) === String(forecastCenterId))
    if (!center) return
    const result = computeForecast(center, parseInt(forecastIncoming) || 0)
    setFcResult(result)
    setFcSaving(true)
    try {
      await api.post('/evacuation_capacity_forecasts', {
        center_id: forecastCenterId,
        current_occupancy: result.curr,
        projected_incoming: result.projected,
        projected_occupancy: result.projOccupancy,
        maximum_capacity: result.cap,
        projected_remaining: result.projRemaining,
        forecast_status: result.status,
        forecast_method: 'deterministic',
      })
    } catch { /* non-fatal */ }
    finally { setFcSaving(false) }
  }

  // ── Comparison tab ─────────────────────────────────────────────────────────
  const [compareIds, setCompareIds] = useState(['', '', ''])
  const compareItems = compareIds.map(id => data.find(c => String(c.id) === String(id)) ?? null)

  // ── History tab ────────────────────────────────────────────────────────────
  const [history, setHistory]           = useState([])
  const [histLoading, setHistLoading]   = useState(false)
  const [showHistAdd, setShowHistAdd]   = useState(false)
  const [histForm, setHistForm]         = useState(BLANK_HISTORY)
  const [histSaving, setHistSaving]     = useState(false)

  useEffect(() => {
    if (tab === 'history') {
      setHistLoading(true)
      api.get(muni ? `/evacuation_history?municipality=${encodeURIComponent(muni)}` : '/evacuation_history')
        .then(rows => setHistory(Array.isArray(rows) ? rows : []))
        .catch(() => setHistory([]))
        .finally(() => setHistLoading(false))
    }
  }, [tab, muni])

  async function saveHistory() {
    if (!histForm.center_id || !histForm.event_name || !histForm.event_date) return
    setHistSaving(true)
    try {
      const center = data.find(c => String(c.id) === String(histForm.center_id))
      const cap = center?.capacity ?? 0
      const total = parseInt(histForm.total_evacuees) || 0
      const util = cap > 0 ? Math.min(100, (total / cap) * 100).toFixed(2) : 0
      const res = await api.post('/evacuation_history', {
        ...histForm,
        total_evacuees: total,
        maximum_occupancy: parseInt(histForm.maximum_occupancy) || total,
        previous_occupancy: parseInt(histForm.previous_occupancy) || 0,
        utilization_percentage: util,
      })
      const newRow = { id: res.id, center_name: center?.name ?? '', ...histForm, utilization_percentage: util }
      setHistory(prev => [newRow, ...prev])
      setHistForm(BLANK_HISTORY); setShowHistAdd(false)
    } catch (e) { alert(e?.error ?? 'Save failed') }
    finally { setHistSaving(false) }
  }

  // ── Derived overview stats ─────────────────────────────────────────────────
  const stats = {
    total:        data.length,
    safe:         data.filter(c => c.overall_status === 'Safe').length,
    atRisk:       data.filter(c => c.overall_status === 'At Risk').length,
    unsafe:       data.filter(c => c.overall_status === 'Unsafe').length,
    full:         data.filter(c => c.overall_status === 'Full').length,
    maintenance:  data.filter(c => c.overall_status === 'Under Maintenance').length,
    unverified:   data.filter(c => c.overall_status === 'Unverified' || !c.overall_status).length,
    totalCap:     data.reduce((s, c) => s + (Number(c.capacity) || 0), 0),
    totalOcc:     data.reduce((s, c) => s + (Number(c.current_occupancy) || 0), 0),
  }
  stats.totalAvail = Math.max(0, stats.totalCap - stats.totalOcc)

  const mapCenter = data.filter(c => c.lat && c.lng).length
    ? [data.filter(c => c.lat && c.lng).reduce((s, c) => s + Number(c.lat), 0) / data.filter(c => c.lat && c.lng).length,
       data.filter(c => c.lat && c.lng).reduce((s, c) => s + Number(c.lng), 0) / data.filter(c => c.lat && c.lng).length]
    : [9.852, 126.073]

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ══════════════════════════════════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 space-y-4">

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]'
                : 'text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
        <button onClick={handleRefresh} disabled={refreshing} className="ml-auto text-slate-500 hover:text-slate-300 p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Centers"    value={stats.total}      icon={Building2}  color="#00d4ff" />
            <StatCard label="Safe"             value={stats.safe}       icon={CheckCircle} color="#22c55e" />
            <StatCard label="At Risk"          value={stats.atRisk}     icon={AlertTriangle} color="#f59e0b" />
            <StatCard label="Unsafe"           value={stats.unsafe}     icon={XCircle}    color="#ef4444" />
            <StatCard label="Full/Near-Cap"    value={stats.full}       icon={Users}      color="#f97316" />
            <StatCard label="Total Capacity"   value={stats.totalCap}   icon={Building2}  color="#8b5cf6" />
            <StatCard label="Current Evacuees" value={stats.totalOcc}   icon={Users}      color="#f59e0b" />
            <StatCard label="Available Spaces" value={stats.totalAvail} icon={CheckCircle} color="#22c55e" />
          </div>

          {/* Status distribution */}
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Center Status Distribution</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(OVERALL_CFG).map(([status, cfg]) => {
                const cnt = data.filter(c => (c.overall_status ?? 'Unverified') === status).length
                return (
                  <span key={status} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <cfg.icon size={11} />
                    {status}: {cnt}
                  </span>
                )
              })}
            </div>
          </GlassCard>

          {/* Occupancy overview */}
          {stats.totalCap > 0 && (
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Overall Occupancy</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{stats.totalOcc} occupied</span>
                  <span>{stats.totalAvail} available</span>
                  <span>{stats.totalCap} capacity</span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (stats.totalOcc / stats.totalCap) * 100).toFixed(1)}%`,
                      background: stats.totalOcc / stats.totalCap > 0.9 ? '#ef4444' : stats.totalOcc / stats.totalCap > 0.7 ? '#f59e0b' : '#22c55e' }} />
                </div>
                <p className="text-xs text-slate-500 text-right">
                  {stats.totalCap > 0 ? ((stats.totalOcc / stats.totalCap) * 100).toFixed(1) : 0}% occupied
                </p>
              </div>
            </GlassCard>
          )}

          {/* GIS Map */}
          {data.filter(c => c.lat && c.lng).length > 0 && (
            <div className="glass rounded-2xl overflow-hidden" style={{ height: 320 }}>
              <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', background: '#0a1628' }} zoomControl>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                {data.filter(c => c.lat && c.lng).map(c => (
                  <Marker key={c.id} position={[Number(c.lat), Number(c.lng)]}
                    icon={shelterIcon(c.overall_status ?? 'Unverified', c.id === selectedId)}
                    eventHandlers={{ click: () => setSelectedId(c.id) }}>
                    <Popup>
                      <div className="bg-[#0f172a] text-white text-xs p-3 rounded-xl min-w-[180px] space-y-1">
                        <p className="font-bold text-[#00d4ff] mb-1">⛺ {c.name}</p>
                        <p className="text-slate-400">Brgy. {c.barangay ?? '—'}</p>
                        <div className="flex items-center gap-1 mt-1"><OverallBadge status={c.overall_status ?? 'Unverified'} /></div>
                        <p className="text-slate-400">Occupancy: {c.current_occupancy ?? 0} / {c.capacity ?? '?'}</p>
                        {c.last_verified_at && <p className="text-slate-500 text-[10px]">Verified: {new Date(c.last_verified_at).toLocaleDateString()}</p>}
                        {c.contact_number && <p className="text-slate-400">{c.contact_number}</p>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Evacuation Centers CRUD ────────────────────────────────────────── */}
      {tab === 'centers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <GlassInput placeholder="Search name or barangay…" icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <GlassSelect value={barangayFilter} onChange={e => setBFilter(e.target.value)} className="w-44">
              <option value="all">All Barangays</option>
              {getBarangays(muni).map(b => <option key={b} value={b}>{b}</option>)}
            </GlassSelect>
            <NeonButton size="sm" onClick={openAdd}><Plus size={13} className="mr-1.5" />Add Center</NeonButton>
          </div>

          {showAdd && <CenterForm title="New Evacuation Center" form={form} set={setF} error={formError} saving={saving} onSave={handleSave} onCancel={closeForm} />}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {['Name', 'Barangay', 'Capacity', 'Occupancy', 'Overall Status', 'Last Verified', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
                    : filtered.length === 0
                      ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No evacuation centers found</td></tr>
                      : filtered.map(row => (
                          <>
                            <tr key={row.id} onClick={() => setSelectedId(row.id)}
                              className={`border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer ${selectedId === row.id ? 'bg-[rgba(0,212,255,0.03)]' : ''}`}>
                              <td className="px-4 py-3 text-sm font-medium text-white">
                                <div className="flex items-center gap-2"><Tent size={13} className="text-[#22c55e]" />{row.name}</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">{row.barangay ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-300">{row.capacity ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-300">
                                {row.current_occupancy ?? 0}
                                {row.capacity ? <span className="text-slate-500"> / {row.capacity}</span> : ''}
                              </td>
                              <td className="px-4 py-3"><OverallBadge status={row.overall_status ?? 'Unverified'} /></td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {row.last_verified_at ? new Date(row.last_verified_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button onClick={e => { e.stopPropagation(); openEdit(row) }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors"><Pencil size={13} /></button>
                                  <button onClick={e => { e.stopPropagation(); handleDelete(row) }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                            {editId === row.id && (
                              <tr key={`edit-${row.id}`} className="bg-[rgba(0,212,255,0.02)]">
                                <td colSpan={7} className="px-4 py-3">
                                  <CenterForm title={`Edit — ${row.name}`} form={form} set={setF} error={formError} saving={saving} onSave={handleSave} onCancel={closeForm} isEdit />
                                </td>
                              </tr>
                            )}
                          </>
                        ))
                  }
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-600 text-right">{filtered.length} of {data.length} centers</p>
        </div>
      )}

      {/* ── Safety Assessment ──────────────────────────────────────────────── */}
      {tab === 'assessment' && (
        <div className="space-y-4">
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Record Assessment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <GlassSelect label="Evacuation Center" value={assessCenterId} onChange={e => setAssessCenterId(e.target.value)}>
                <option value="">Select center…</option>
                {data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GlassSelect>
              <GlassSelect label="Safety Status" value={assessForm.safety_status} onChange={e => setAssessForm(p => ({ ...p, safety_status: e.target.value }))}>
                <option value="Safe">Safe</option>
                <option value="At Risk">At Risk</option>
                <option value="Unsafe">Unsafe</option>
                <option value="Unverified">Unverified</option>
              </GlassSelect>
              <GlassSelect label="Operational Status" value={assessForm.operational_status} onChange={e => setAssessForm(p => ({ ...p, operational_status: e.target.value }))}>
                <option value="Operational">Operational</option>
                <option value="Maintenance">Under Maintenance</option>
                <option value="Unavailable">Unavailable</option>
              </GlassSelect>
              <GlassSelect label="Accessibility Status" value={assessForm.accessibility_status} onChange={e => setAssessForm(p => ({ ...p, accessibility_status: e.target.value }))}>
                <option value="Accessible">Accessible</option>
                <option value="Limited">Limited</option>
                <option value="Inaccessible">Inaccessible</option>
                <option value="Unverified">Unverified</option>
              </GlassSelect>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <GlassTextarea label="Hazard Report" value={assessForm.hazard_report} onChange={e => setAssessForm(p => ({ ...p, hazard_report: e.target.value }))} placeholder="Describe identified hazards, if any…" rows={3} />
              <GlassInput label="Assessment Source" value={assessForm.assessment_source} onChange={e => setAssessForm(p => ({ ...p, assessment_source: e.target.value }))} placeholder="Field inspection, remote report…" />
            </div>
            {assessCenterId && (
              <div className="text-xs text-slate-500 mb-3 p-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                Computed classification: <OverallBadge status={computeOverall(assessForm.safety_status, assessForm.operational_status,
                  data.find(c => String(c.id) === String(assessCenterId))?.current_occupancy ?? 0,
                  data.find(c => String(c.id) === String(assessCenterId))?.capacity ?? 0,
                  assessForm.accessibility_status)} />
              </div>
            )}
            {assessError && <p className="text-xs text-[#ef4444] mb-2">{assessError}</p>}
            <NeonButton size="sm" onClick={saveAssessment} loading={assessSaving}>Save Assessment &amp; Verify</NeonButton>
          </GlassCard>

          {assessCenterId && assessments.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assessment History</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      {['Date', 'Safety', 'Operational', 'Accessibility', 'Result', 'Source'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map(a => (
                      <tr key={a.id} className="border-b border-[rgba(255,255,255,0.04)]">
                        <td className="px-4 py-3 text-xs text-slate-400">{a.assessed_at ? new Date(a.assessed_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{a.safety_status}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{a.operational_status}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{a.accessibility_status}</td>
                        <td className="px-4 py-3"><OverallBadge status={a.assessment_result} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{a.assessment_source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Occupancy & Resources ──────────────────────────────────────────── */}
      {tab === 'occupancy' && (
        <div className="space-y-4">
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Update Occupancy</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <GlassSelect label="Evacuation Center" value={occCenterId} onChange={e => { setOccCenterId(e.target.value); setNewOccupancy('') }}>
                <option value="">Select center…</option>
                {data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GlassSelect>
              {occCenter && (
                <>
                  <GlassInput label="Current Evacuees" type="number" value={newOccupancy} onChange={e => setNewOccupancy(e.target.value)}
                    placeholder={`Current: ${occCenter.current_occupancy ?? 0}`} min="0" />
                  <div>
                    <NeonButton size="sm" onClick={saveOccupancy} loading={occSaving}>Update Occupancy</NeonButton>
                  </div>
                </>
              )}
            </div>
            {occCenter && (
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="glass rounded-xl p-3">
                  <p className="text-lg font-black text-[#00d4ff]">{occCenter.capacity ?? '—'}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Max Capacity</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-lg font-black text-[#f59e0b]">{occCenter.current_occupancy ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Occupied</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-lg font-black text-[#22c55e]">{Math.max(0, (occCenter.capacity ?? 0) - (occCenter.current_occupancy ?? 0))}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Available</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* ── Evacuees Arrived / Departed ──────────────────────────────── */}
          {occCenterId && (
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <Users size={12} className="inline mr-1.5" />Occupancy Tracking
              </p>

              {/* Capacity status badge */}
              {occCenter?.capacity_status && (
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium ${
                    occCenter.capacity_status === 'Full'             ? 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]' :
                    occCenter.capacity_status === 'Nearly Full'      ? 'bg-[rgba(249,115,22,0.12)] text-[#f97316]' :
                    occCenter.capacity_status === 'Mostly Occupied'  ? 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]' :
                    'bg-[rgba(34,197,94,0.12)] text-[#22c55e]'
                  }`}>
                    {occCenter.capacity_status}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => { setArrivedOpen(p => !p); setDepartedOpen(false); resetCheckForm() }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition-colors ${arrivedOpen ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.4)] text-[#22c55e]' : 'bg-[rgba(34,197,94,0.06)] border-[rgba(34,197,94,0.2)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.12)]'}`}>
                  <UserPlus size={20} />
                  <span className="text-xs font-semibold">Evacuees Arrived</span>
                </button>
                <button onClick={() => { setDepartedOpen(p => !p); setArrivedOpen(false); resetCheckForm() }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition-colors ${departedOpen ? 'bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.4)] text-[#f97316]' : 'bg-[rgba(249,115,22,0.06)] border-[rgba(249,115,22,0.2)] text-[#f97316] hover:bg-[rgba(249,115,22,0.12)]'}`}>
                  <UserMinus size={20} />
                  <span className="text-xs font-semibold">Evacuees Departed</span>
                </button>
              </div>

              {/* Arrived form */}
              {arrivedOpen && (
                <div className="mb-4 p-3 rounded-xl bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.15)] space-y-3">
                  <p className="text-xs font-semibold text-[#22c55e]">Record Arrival</p>
                  <QRScanField
                    onScan={({ evacueeId, evacueeName }) => { setCheckEvacueeRef(evacueeId); setCheckEvacueeName(evacueeName) }}
                    scannerMode={checkScannerMode}
                    setScannerMode={setCheckScannerMode}
                    evacueeRef={checkEvacueeRef}
                    setEvacueeRef={setCheckEvacueeRef}
                    evacueeName={checkEvacueeName}
                    setEvacueeName={setCheckEvacueeName}
                  />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Group Size</p>
                    <input type="number" min="1" value={checkGroupSize} onChange={e => setCheckGroupSize(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(34,197,94,0.5)]" />
                  </div>
                  {checkError && <p className="text-xs text-[#ef4444]">{checkError}</p>}
                  <NeonButton size="sm" onClick={recordArrival} loading={checkSaving}>
                    <UserPlus size={12} className="mr-1.5" />Confirm Arrival
                  </NeonButton>
                </div>
              )}

              {/* Departed form */}
              {departedOpen && (
                <div className="mb-4 p-3 rounded-xl bg-[rgba(249,115,22,0.05)] border border-[rgba(249,115,22,0.15)] space-y-3">
                  <p className="text-xs font-semibold text-[#f97316]">Record Departure</p>
                  <QRScanField
                    onScan={({ evacueeId, evacueeName }) => { setCheckEvacueeRef(evacueeId); setCheckEvacueeName(evacueeName) }}
                    scannerMode={checkScannerMode}
                    setScannerMode={setCheckScannerMode}
                    evacueeRef={checkEvacueeRef}
                    setEvacueeRef={setCheckEvacueeRef}
                    evacueeName={checkEvacueeName}
                    setEvacueeName={setCheckEvacueeName}
                  />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Group Size</p>
                    <input type="number" min="1" value={checkGroupSize} onChange={e => setCheckGroupSize(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(249,115,22,0.5)]" />
                  </div>
                  {checkError && <p className="text-xs text-[#ef4444]">{checkError}</p>}
                  <NeonButton size="sm" onClick={recordDeparture} loading={checkSaving}>
                    <UserMinus size={12} className="mr-1.5" />Confirm Departure
                  </NeonButton>
                </div>
              )}

              {/* Recent occupancy events */}
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Recent Events</p>
                  <button onClick={loadRecentEvents} className="text-[10px] text-[#00d4ff] hover:underline">Refresh</button>
                </div>
                {recentEvents.length === 0
                  ? <p className="text-[11px] text-slate-600 text-center py-3">No events yet — use the buttons above to record arrivals or departures.</p>
                  : recentEvents.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <div className="flex items-center gap-2">
                        {ev.event_type === 'ARRIVAL'
                          ? <UserPlus size={11} className="text-[#22c55e]" />
                          : <UserMinus size={11} className="text-[#f97316]" />}
                        <span className="text-xs text-slate-300">{ev.evacuee_ref ?? 'Anonymous'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ev.event_type === 'ARRIVAL' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(249,115,22,0.1)] text-[#f97316]'}`}>
                          {ev.event_type === 'ARRIVAL' ? `+${ev.quantity}` : `-${ev.quantity}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  ))}
              </div>
            </GlassCard>
          )}

          {occCenterId && (
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <Package size={12} className="inline mr-1.5" />Resources
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <GlassInput label="Resource Name" value={resourceForm.resource_name} onChange={e => setResourceForm(p => ({ ...p, resource_name: e.target.value }))} placeholder="Water" />
                <GlassInput label="Quantity" type="number" value={resourceForm.quantity_available} onChange={e => setResourceForm(p => ({ ...p, quantity_available: e.target.value }))} placeholder="100" />
                <GlassInput label="Unit" value={resourceForm.unit} onChange={e => setResourceForm(p => ({ ...p, unit: e.target.value }))} placeholder="liters" />
                <GlassSelect label="Availability" value={resourceForm.availability_status} onChange={e => setResourceForm(p => ({ ...p, availability_status: e.target.value }))}>
                  <option value="Available">Available</option>
                  <option value="Limited">Limited</option>
                  <option value="Unavailable">Unavailable</option>
                </GlassSelect>
              </div>
              <div className="flex gap-2 mb-4">
                <NeonButton size="sm" onClick={saveResource} loading={resSaving}>{editResId ? 'Update' : 'Add Resource'}</NeonButton>
                {editResId && <NeonButton variant="ghost" size="sm" onClick={() => { setEditResId(null); setResourceForm(BLANK_RESOURCE) }}>Cancel</NeonButton>}
              </div>
              {resources.length > 0 && (
                <div className="glass rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.06)]">
                        {['Resource', 'Qty', 'Unit', 'Status', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map(r => (
                        <tr key={r.id} className="border-b border-[rgba(255,255,255,0.04)]">
                          <td className="px-3 py-2 text-xs text-slate-200">{r.resource_name}</td>
                          <td className="px-3 py-2 text-xs text-slate-300">{r.quantity_available}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{r.unit}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              r.availability_status === 'Available' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' :
                              r.availability_status === 'Limited'   ? 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]' :
                              'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'}`}>{r.availability_status}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditResId(r.id); setResourceForm({ resource_name: r.resource_name, quantity_available: r.quantity_available, unit: r.unit, availability_status: r.availability_status }) }}
                                className="p-1 rounded text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors"><Pencil size={12} /></button>
                              <button onClick={() => deleteResource(r.id)}
                                className="p-1 rounded text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {resources.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No resources recorded yet</p>}
            </GlassCard>
          )}
        </div>
      )}

      {/* ── AI Insights ───────────────────────────────────────────────────── */}
      {tab === 'insights' && (
        <div className="space-y-4">
          {/* Recommendation */}
          <GlassCard glow>
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Evacuation Recommendation Engine</p>
            <p className="text-xs text-slate-500 mb-3">Enter a victim's location to find the most suitable evacuation center based on safety, capacity, accessibility, and distance.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <GlassInput label="Victim Latitude" type="number" value={recLat} onChange={e => setRecLat(e.target.value)} placeholder="9.8520" />
              <GlassInput label="Victim Longitude" type="number" value={recLng} onChange={e => setRecLng(e.target.value)} placeholder="126.0730" />
              <div className="flex items-end">
                <NeonButton size="sm" onClick={runRecommendation} className="w-full">Generate Recommendation</NeonButton>
              </div>
            </div>
            {recError && <p className="text-xs text-[#ef4444] mb-2">{recError}</p>}
            {recommendation && (
              <div className="space-y-3 mt-4">
                <RecommendationCard center={recommendation.top} rank={1} label="Recommended" />
                {recommendation.alternatives.map((c, i) => (
                  <RecommendationCard key={c.id} center={c} rank={i + 2} label="Alternative" compact />
                ))}
              </div>
            )}
          </GlassCard>

          {/* Capacity Forecast */}
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Capacity Forecast</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <GlassSelect label="Evacuation Center" value={forecastCenterId} onChange={e => { setFcId(e.target.value); setFcResult(null) }}>
                <option value="">Select center…</option>
                {data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GlassSelect>
              <GlassInput label="Projected Incoming Evacuees" type="number" value={forecastIncoming} onChange={e => setFcIn(e.target.value)} placeholder="150" min="0" />
              <div className="flex items-end">
                <NeonButton size="sm" onClick={saveForecast} loading={forecastSaving} className="w-full">Generate &amp; Save Forecast</NeonButton>
              </div>
            </div>
            {forecastResult && (() => {
              const statusColors = { 'Can Accommodate': '#22c55e', 'Near Capacity': '#f59e0b', 'Exceeds Capacity': '#ef4444', Unknown: '#9ca3af' }
              const col = statusColors[forecastResult.status] ?? '#60a5fa'
              return (
                <div className="glass rounded-xl p-4 mt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black" style={{ color: col }}>{forecastResult.status}</span>
                    <span className="text-xs text-slate-500">— Deterministic forecast</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div><p className="font-bold text-slate-200">{forecastResult.curr}</p><p className="text-slate-500">Current</p></div>
                    <div><p className="font-bold text-[#f59e0b]">+{forecastResult.projected}</p><p className="text-slate-500">Projected incoming</p></div>
                    <div><p className="font-bold" style={{ color: col }}>{forecastResult.projOccupancy}</p><p className="text-slate-500">Projected total</p></div>
                    <div><p className="font-bold text-slate-200">{forecastResult.cap}</p><p className="text-slate-500">Max capacity</p></div>
                    <div><p className="font-bold" style={{ color: col }}>{forecastResult.projRemaining}</p><p className="text-slate-500">Projected remaining</p></div>
                    <div><p className="font-bold text-slate-400">{forecastResult.cap > 0 ? ((forecastResult.projOccupancy / forecastResult.cap) * 100).toFixed(1) : 0}%</p><p className="text-slate-500">Projected occupancy</p></div>
                  </div>
                  <p className="text-[10px] text-slate-600">This forecast is an estimate based on current data. Actual conditions may differ.</p>
                </div>
              )
            })()}
          </GlassCard>
        </div>
      )}

      {/* ── Center Comparison ─────────────────────────────────────────────── */}
      {tab === 'comparison' && (
        <div className="space-y-4">
          <GlassCard>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Centers to Compare (up to 3)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <GlassSelect key={i} label={`Center ${i + 1}`} value={compareIds[i]}
                  onChange={e => setCompareIds(prev => { const n = [...prev]; n[i] = e.target.value; return n })}>
                  <option value="">— None —</option>
                  {data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </GlassSelect>
              ))}
            </div>
          </GlassCard>

          {compareItems.filter(Boolean).length >= 2 && (() => {
            const items = compareItems.filter(Boolean)
            const rowDefs = [
              { label: 'Overall Status',    getValue: c => <OverallBadge status={c.overall_status ?? 'Unverified'} />, isBest: null },
              { label: 'Safety Status',     getValue: c => c.safety_status ?? 'Unverified', isBest: (vals) => vals.indexOf('Safe') },
              { label: 'Operational',       getValue: c => c.operational_status ?? '—', isBest: null },
              { label: 'Accessibility',     getValue: c => c.accessibility_status ?? 'Unverified', isBest: (vals) => vals.indexOf('Accessible') },
              { label: 'Max Capacity',      getValue: c => c.capacity ?? '—', isBest: (vals) => vals.indexOf(Math.max(...vals.filter(v => v !== '—'))) },
              { label: 'Current Occupancy', getValue: c => c.current_occupancy ?? 0, isBest: (vals) => vals.indexOf(Math.min(...vals)) },
              { label: 'Available Spaces',  getValue: c => Math.max(0, (c.capacity ?? 0) - (c.current_occupancy ?? 0)), isBest: (vals) => vals.indexOf(Math.max(...vals)) },
              { label: 'Last Verified',     getValue: c => c.last_verified_at ? new Date(c.last_verified_at).toLocaleDateString() : 'Never', isBest: null },
            ]
            const scores = items.map(c => computeRecommendationScore(c, [9.852, 126.073], data))
            const bestIdx = scores.indexOf(Math.max(...scores))
            return (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs font-semibold text-[#00d4ff]">
                    Best overall: {items[bestIdx]?.name}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.06)]">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Criteria</th>
                        {items.map(c => (
                          <th key={c.id} className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider ${bestIdx === items.indexOf(c) ? 'text-[#00d4ff]' : 'text-slate-500'}`}>
                            {c.name}
                            {bestIdx === items.indexOf(c) && <span className="ml-1 text-[8px]">★ BEST</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowDefs.map(row => {
                        const vals = items.map(row.getValue)
                        const bestI = row.isBest ? row.isBest(vals) : -1
                        return (
                          <tr key={row.label} className="border-b border-[rgba(255,255,255,0.04)]">
                            <td className="px-4 py-3 text-xs font-medium text-slate-400">{row.label}</td>
                            {vals.map((v, i) => (
                              <td key={i} className={`px-4 py-3 text-xs ${bestI === i ? 'text-[#22c55e] font-semibold' : 'text-slate-300'}`}>
                                {v}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Evacuation History ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-300">Evacuation Events</p>
            <NeonButton size="sm" onClick={() => setShowHistAdd(p => !p)}>
              <Plus size={13} className="mr-1.5" />{showHistAdd ? 'Cancel' : 'Add Event'}
            </NeonButton>
          </div>

          {showHistAdd && (
            <GlassCard>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">New Evacuation Event</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <GlassSelect label="Evacuation Center" value={histForm.center_id} onChange={e => setHistForm(p => ({ ...p, center_id: e.target.value }))}>
                  <option value="">Select center…</option>
                  {data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </GlassSelect>
                <GlassInput label="Event Name" value={histForm.event_name} onChange={e => setHistForm(p => ({ ...p, event_name: e.target.value }))} placeholder="Typhoon Response 2026" />
                <GlassInput label="Event Date" type="date" value={histForm.event_date} onChange={e => setHistForm(p => ({ ...p, event_date: e.target.value }))} />
                <GlassInput label="Total Evacuees" type="number" value={histForm.total_evacuees} onChange={e => setHistForm(p => ({ ...p, total_evacuees: e.target.value }))} placeholder="300" />
                <GlassInput label="Max Occupancy Reached" type="number" value={histForm.maximum_occupancy} onChange={e => setHistForm(p => ({ ...p, maximum_occupancy: e.target.value }))} placeholder="350" />
              </div>
              <NeonButton size="sm" onClick={saveHistory} loading={histSaving}>Save Event</NeonButton>
            </GlassCard>
          )}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {['Event', 'Center', 'Date', 'Total Evacuees', 'Max Capacity', 'Utilization'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {histLoading
                    ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
                    : history.length === 0
                      ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No evacuation events recorded</td></tr>
                      : history.map(h => {
                          const util = parseFloat(h.utilization_percentage) || 0
                          return (
                            <tr key={h.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                              <td className="px-4 py-3 text-sm font-medium text-white">{h.event_name}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">{h.center_name ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">{h.event_date ? new Date(h.event_date).toLocaleDateString() : '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-300">{h.total_evacuees}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">{h.maximum_occupancy}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  util >= 90 ? 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]' :
                                  util >= 70 ? 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]' :
                                  'bg-[rgba(34,197,94,0.1)] text-[#22c55e]'}`}>
                                  {util.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          )
                        })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inner components ───────────────────────────────────────────────────────────
function CenterForm({ title, form, set, error, saving, onSave, onCancel }) {
  return (
    <GlassCard>
      <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <GlassInput label="Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Del Carmen Gymnasium" />
        <GlassSelect label="Province" value={form.province} onChange={e => set('province', e.target.value)} disabled>
          <option value="">Select Province</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </GlassSelect>
        <GlassSelect label="Municipality" value={form.municipality} onChange={e => set('municipality', e.target.value)} disabled>
          <option value="">Select Municipality</option>
          {getMunicipalities(form.province).map(m => <option key={m} value={m}>{m}</option>)}
        </GlassSelect>
        <GlassSelect label="Barangay" value={form.barangay} onChange={e => set('barangay', e.target.value)}>
          <option value="">Select Barangay</option>
          {getBarangays(form.municipality).map(b => <option key={b} value={b}>{b}</option>)}
        </GlassSelect>
        <GlassInput label="Address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Poblacion, Del Carmen" />
        <GlassInput label="Max Capacity" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="500" type="number" />
        <GlassInput label="Latitude *" value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="9.8520" type="number" />
        <GlassInput label="Longitude *" value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="126.0730" type="number" />
        <GlassInput label="Contact Number" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
        <GlassSelect label="Operational Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="open">Open</option>
          <option value="full">Full</option>
          <option value="closed">Closed</option>
        </GlassSelect>
        <GlassSelect label="Safety Status" value={form.safety_status} onChange={e => set('safety_status', e.target.value)}>
          <option value="Unverified">Unverified</option>
          <option value="Safe">Safe</option>
          <option value="At Risk">At Risk</option>
          <option value="Unsafe">Unsafe</option>
        </GlassSelect>
        <GlassSelect label="Accessibility" value={form.accessibility_status} onChange={e => set('accessibility_status', e.target.value)}>
          <option value="Unverified">Unverified</option>
          <option value="Accessible">Accessible</option>
          <option value="Limited">Limited</option>
          <option value="Inaccessible">Inaccessible</option>
        </GlassSelect>
      </div>
      {error && <p className="text-xs text-[#ef4444] mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <NeonButton size="sm" onClick={onSave} loading={saving}>Save</NeonButton>
        <NeonButton variant="ghost" size="sm" onClick={onCancel}>Cancel</NeonButton>
      </div>
    </GlassCard>
  )
}

function QRScanField({ onScan, scannerMode, setScannerMode, evacueeRef, setEvacueeRef, evacueeName, setEvacueeName }) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const qrRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!overlayOpen) return
    let mounted = true
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const qr = new Html5Qrcode('qr-fs-admin')
        if (!mounted) return
        qrRef.current = qr
        await qr.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (!text.startsWith('SURVPH:EVACUEE:')) return
            const parts = text.split(':')
            const eid = parts[2] ?? ''; const ename = parts[3] ?? ''
            setEvacueeRef(eid); setEvacueeName(ename)
            onScan({ evacueeId: eid, evacueeName: ename })
            setScanSuccess(true)
            qr.stop().catch(() => {}); qrRef.current = null
            setTimeout(() => { setOverlayOpen(false); setScannerMode(false); setScanSuccess(false) }, 1200)
          },
          () => {}
        )
      } catch { if (mounted) { setOverlayOpen(false); setScannerMode(false) } }
    }, 150)
    return () => {
      mounted = false; clearTimeout(timer)
      if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
    }
  }, [overlayOpen])

  function openScanner() { setScanSuccess(false); setGalleryError(''); setOverlayOpen(true); setScannerMode(true) }
  function closeScanner() {
    if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
    setOverlayOpen(false); setScannerMode(false); setGalleryError('')
  }

  async function handleGalleryFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setGalleryError('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      let tempEl = document.getElementById('qr-file-reader-tmp')
      if (!tempEl) {
        tempEl = document.createElement('div')
        tempEl.id = 'qr-file-reader-tmp'
        tempEl.style.display = 'none'
        document.body.appendChild(tempEl)
      }
      const qr = new Html5Qrcode('qr-file-reader-tmp')
      const result = await qr.scanFileV2(file, false)
      const text = result.decodedText
      if (text.startsWith('SURVPH:EVACUEE:')) {
        const parts = text.split(':')
        const eid = parts[2] ?? ''; const ename = parts[3] ?? ''
        if (qrRef.current) { await qrRef.current.stop().catch(() => {}); qrRef.current = null }
        setEvacueeRef(eid); setEvacueeName(ename)
        onScan({ evacueeId: eid, evacueeName: ename })
        setScanSuccess(true)
        setTimeout(() => { setOverlayOpen(false); setScannerMode(false); setScanSuccess(false); setGalleryError('') }, 1200)
      } else {
        setGalleryError('QR found but not a valid victim QR. Try a different image.')
      }
    } catch {
      setGalleryError('No QR code detected. Try a clearer photo.')
    }
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={openScanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-[rgba(0,212,255,0.08)] border-[rgba(0,212,255,0.25)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.16)] transition-colors">
            <Camera size={11} />Scan QR
          </button>
          <span className="text-[10px] text-slate-500">or enter manually:</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Victim ID (optional)</p>
            <input value={evacueeRef} onChange={e => setEvacueeRef(e.target.value)} placeholder="From QR scan…"
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Name (optional)</p>
            <input value={evacueeName} onChange={e => setEvacueeName(e.target.value)} placeholder="Name…"
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Full-screen QR camera overlay — matching YOLO camera design */}
      {overlayOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* CSS overrides to make Html5Qrcode fill the viewfinder */}
          <style>{`
            #qr-fs-admin,#qr-fs-admin>div{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;padding:0!important;border:none!important;background:transparent!important;}
            #qr-fs-admin video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;}
            #qr-fs-admin__scan_region{display:none!important;}
            #qr-fs-admin__dashboard_section{display:none!important;}
            #qr-fs-admin img{display:none!important;}
          `}</style>

          {/* Viewfinder */}
          <div className="flex-1 relative overflow-hidden">
            {/* Html5Qrcode renders camera stream here */}
            <div id="qr-fs-admin" />

            {/* Dim mask + QR frame */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Semi-dark surround */}
              <div className="absolute inset-0 bg-black/40" />
              {/* Scan frame — 220×220 to match qrbox */}
              <div className="relative z-10 w-[220px] h-[220px]">
                {/* Clear window */}
                <div className="absolute inset-0 bg-transparent" />
                {/* Corner brackets */}
                <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-[#00d4ff] rounded-tl-sm" />
                <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-[#00d4ff] rounded-tr-sm" />
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-[#00d4ff] rounded-bl-sm" />
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-[#00d4ff] rounded-br-sm" />
                {/* Scanning beam */}
                {!scanSuccess && (
                  <div className="absolute left-1 right-1 h-[2px] bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent opacity-80 animate-[scanBeam_1.8s_ease-in-out_infinite]" />
                )}
              </div>
            </div>

            {/* Top header */}
            <div className="absolute top-0 left-0 right-0 px-4 pt-4 pb-8 bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3">
              <button onClick={closeScanner} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors text-base leading-none">✕</button>
              <QrCode size={14} className="text-[#00d4ff]" />
              <p className="text-sm font-semibold text-white/90">Scan Victim QR Code</p>
            </div>
          </div>

          {/* Bottom controls — matching YOLO shutter bar style */}
          <div className="bg-black/90 px-6 py-7 flex flex-col items-center gap-2.5">
            {scanSuccess ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[rgba(34,197,94,0.2)] border border-[rgba(34,197,94,0.5)] flex items-center justify-center">
                  <CheckCircle size={18} className="text-[#22c55e]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#22c55e]">QR Code Scanned</p>
                  <p className="text-[10px] text-white/40">Closing scanner…</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  <p className="text-xs text-white/70 font-medium">Scanning for QR code…</p>
                </div>
                <p className="text-[11px] text-white/35 text-center leading-relaxed">
                  Align the victim's QR code within the cyan frame
                </p>
                {galleryError && (
                  <p className="text-[11px] text-red-400 text-center">{galleryError}</p>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors underline mt-1"
                >
                  Use image from gallery instead
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryFile}
      />
    </>
  )
}

function RecommendationCard({ center, rank, label, compact = false }) {
  const avail = Math.max(0, (center.capacity ?? 0) - (center.current_occupancy ?? 0))
  const explanation = generateExplanation(center, center.distKm ?? 0)
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      rank === 1 ? 'border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.05)]' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${rank === 1 ? 'bg-[rgba(0,212,255,0.15)] text-[#00d4ff]' : 'bg-[rgba(255,255,255,0.08)] text-slate-400'}`}>
            {label} #{rank}
          </span>
          <span className="text-sm font-semibold text-white">{center.name}</span>
        </div>
        <span className="text-xs text-slate-500">{(center.distKm ?? 0).toFixed(1)} km</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <OverallBadge status={center.overall_status ?? 'Unverified'} />
        <span className="text-slate-400">{center.current_occupancy ?? 0}/{center.capacity ?? '?'} occupied</span>
        <span className="text-[#22c55e]">{avail} available</span>
        <span className="text-slate-500">Score: {(center.score ?? 0).toFixed(1)}</span>
      </div>
      {!compact && <p className="text-[11px] text-slate-500 leading-relaxed">{explanation}</p>}
    </div>
  )
}
