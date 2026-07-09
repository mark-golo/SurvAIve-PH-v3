import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Users, Phone, Clock, Navigation, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react'
import { TopBar } from '../../components/ui/NavBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassTextarea } from '../../components/ui/GlassInput'
import api from '../../lib/api'

const DEMO_VICTIMS = {
  1: { id: 1, name: 'Maria Santos',    status: 'trapped',  priority: 'CRITICAL', people_count: 4,  barangay: 'Del Carmen Poblacion', lat: 9.8527, lng: 126.0736, notes: 'Floodwater rising fast, second floor', contact: '+63920000001', vulnerabilities: ['Elderly (60+)', 'Infant'], is_verified: true,  rescue_status: 'pending' },
  2: { id: 2, name: 'Juan Dela Cruz',  status: 'injured',  priority: 'HIGH',     people_count: 2,  barangay: 'Bitoon',    lat: 9.8720, lng: 126.0690, notes: 'Roof collapsed, leg injury',            contact: '+63920000002', vulnerabilities: [],      is_verified: true,  rescue_status: 'en_route' },
  3: { id: 3, name: 'Rosa Villanueva', status: 'trapped',  priority: 'CRITICAL', people_count: 6,  barangay: 'Caub',      lat: 9.8610, lng: 126.0780, notes: 'Pregnant woman, need urgent help',      contact: '+63920000003', vulnerabilities: ['Pregnant', 'PWD'], is_verified: true,  rescue_status: 'pending' },
  4: { id: 4, name: 'Guest User',      status: 'injured',  priority: 'HIGH',     people_count: 3,  barangay: 'Cancohoy',  lat: 9.8560, lng: 126.0620, notes: '5 children trapped inside school',     contact: null,           vulnerabilities: [],      is_verified: false, rescue_status: 'pending' },
}

const ACTIONS = [
  { label: 'En Route',     value: 'en_route',    variant: 'blue',   icon: Navigation  },
  { label: 'On Scene',     value: 'on_scene',    variant: 'orange', icon: MapPin      },
  { label: 'Rescued',      value: 'rescued',     variant: 'green',  icon: CheckCircle },
  { label: 'Cannot Reach', value: 'cannot_reach',variant: 'ghost',  icon: XCircle     },
]

export function RescueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fallback = DEMO_VICTIMS[id] ?? DEMO_VICTIMS[1]

  const [victim, setVictim] = useState(fallback)
  const [rescueStatus, setRescueStatus] = useState(fallback.rescue_status)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(null)

  useEffect(() => {
    api.get(`/sos/${id}`)
      .then(row => {
        setVictim({
          id: row.id,
          name: row.name ?? 'Unknown',
          status: row.status,
          priority: row.priority ?? 'HIGH',
          people_count: row.people_count,
          barangay: row.barangay,
          lat: row.lat, lng: row.lng,
          notes: row.notes,
          contact: row.contact_number,
          vulnerabilities: Array.isArray(row.vulnerabilities) ? row.vulnerabilities : [],
          is_verified: !!row.is_verified,
          rescue_status: row.rescue_status,
        })
        setRescueStatus(row.rescue_status ?? 'pending')
      })
      .catch(() => {})
  }, [id])

  const updateStatus = async (newStatus) => {
    setLoading(true)
    if (newStatus === 'on_scene') setTimer(Date.now())
    try {
      await api.put(`/sos/${victim.id}`, { rescue_status: newStatus, field_notes: notes })
      setRescueStatus(newStatus)
    } catch { setRescueStatus(newStatus) }
    setLoading(false)
  }

  const elapsed = timer ? Math.floor((Date.now() - timer) / 1000) : null

  const openMap = () => {
    if (victim.lat) window.open(`https://www.openstreetmap.org/?mlat=${victim.lat}&mlon=${victim.lng}&zoom=17`, '_blank')
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col pb-6">
      <TopBar title="Rescue Detail" subtitle={`Victim #${victim.id}`} onBack />

      <main className="flex-1 p-4 space-y-4">
        {/* Priority banner */}
        <div className={`glass rounded-xl p-3 border ${
          victim.priority === 'CRITICAL' ? 'border-[rgba(239,68,68,0.5)]' :
          victim.priority === 'HIGH'     ? 'border-[rgba(249,115,22,0.5)]' :
          'border-[rgba(245,158,11,0.5)]'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#ef4444] shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={victim.priority} pulse />
                {victim.is_verified
                  ? <span className="text-[10px] text-[#00d4ff] font-medium">✓ Verified</span>
                  : <span className="text-[10px] text-[#f59e0b] font-medium">⚠ Guest</span>
                }
              </div>
              <p className="font-bold text-white mt-1">{victim.name}</p>
            </div>
          </div>
        </div>

        {/* Victim details */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Victim Information</p>
          <div className="space-y-2.5">
            <Detail icon={MapPin}  label="Location"   value={`${victim.barangay} · ${victim.lat?.toFixed(4)}, ${victim.lng?.toFixed(4)}`} />
            <Detail icon={Users}   label="People"     value={`${victim.people_count} person(s)`} />
            <Detail icon={AlertTriangle} label="Status" value={victim.status} />
            {victim.contact && <Detail icon={Phone} label="Contact" value={victim.contact} />}
          </div>
          {victim.vulnerabilities?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {victim.vulnerabilities.map(v => (
                <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444]">
                  {v}
                </span>
              ))}
            </div>
          )}
          {victim.notes && (
            <p className="mt-3 text-xs text-slate-400 italic border-t border-[rgba(255,255,255,0.06)] pt-3">
              "{victim.notes}"
            </p>
          )}
        </GlassCard>

        {/* Rescue status */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Rescue Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(({ label, value, variant, icon: Icon }) => (
              <NeonButton
                key={value}
                variant={rescueStatus === value ? variant : 'ghost'}
                onClick={() => updateStatus(value)}
                disabled={loading}
                className={`flex items-center justify-center gap-2 ${rescueStatus === value ? 'ring-1 ring-offset-0' : ''}`}
                size="sm"
              >
                <Icon size={13} />
                {label}
              </NeonButton>
            ))}
          </div>
          {rescueStatus && (
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-slate-500">Current:</p>
              <StatusBadge status={rescueStatus.toUpperCase().replace('_', ' ')} pulse={rescueStatus === 'en_route'} />
              {elapsed && <p className="text-xs text-slate-500">On scene {elapsed}s</p>}
            </div>
          )}
        </GlassCard>

        {/* Field notes */}
        <GlassCard>
          <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Field Notes</p>
          <GlassTextarea
            placeholder="Describe the scene, actions taken, equipment used…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </GlassCard>

        {/* Map link */}
        {victim.lat && (
          <NeonButton variant="violet" onClick={openMap} className="w-full">
            <MapPin size={14} className="mr-2" />
            Open Location in Map
          </NeonButton>
        )}
      </main>
    </div>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  )
}
