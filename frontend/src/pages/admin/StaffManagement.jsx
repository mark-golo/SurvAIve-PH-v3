import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, UserCog, ShieldCheck, Radio, Eye, EyeOff } from 'lucide-react'

import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { PROVINCES, getMunicipalities, getBarangays } from '../../lib/philippineLocations'

const AGENCY_TYPES = [
  { value: 'mdrrmo',   label: 'MDRRMO',             color: '#00d4ff' },
  { value: 'hospital', label: 'Hospital / Medical',  color: '#22c55e' },
  { value: 'bfp',      label: 'BFP',                color: '#ef4444' },
  { value: 'pnp',      label: 'PNP',                color: '#8b5cf6' },
  { value: 'pcg',      label: 'PCG',                color: '#0ea5e9' },
]

const BLANK_ADMIN  = { name: '', contact_number: '', gmail: '', province: '', municipality: '', password: '', status: 'active' }
const BLANK_AGENCY = { name: '', contact_number: '', agency_type: 'mdrrmo', province: '', municipality: '', password: '', status: 'active' }
const BLANK_RESP   = { name: '', contact_number: '', gmail: '', province: '', municipality: '', barangay: '', password: '', team_id: '', unit_name: '', assigned_zone: '', assigned_barangay: '', status: 'active' }

export function StaffManagement() {
  const { scope } = useAuthStore()
  const muni = scope?.municipality
  const prov = scope?.province

  const [tab, setTab]             = useState('admins')
  const [admins, setAdmins]       = useState([])
  const [agencies, setAgencies]   = useState([])
  const [resps, setResps]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(BLANK_ADMIN)
  const [showPw, setShowPw]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    const q     = muni ? `?municipality=${encodeURIComponent(muni)}` : ''
    const qProv = prov ? `?province=${encodeURIComponent(prov)}` : ''
    Promise.all([
      api.get(`/admins${qProv}`).catch(() => []),
      api.get(`/agencies${q}`).catch(() => []),
      api.get(`/responders${q}`).catch(() => []),
    ]).then(([a, ag, r]) => { setAdmins(a); setAgencies(ag); setResps(r) })
      .finally(() => setLoading(false))
  }, [])

  const isAdminTab  = tab === 'admins'
  const isAgencyTab = tab === 'agencies'
  const data        = isAdminTab ? admins  : isAgencyTab ? agencies : resps
  const blank       = isAdminTab ? BLANK_ADMIN : isAgencyTab ? BLANK_AGENCY : BLANK_RESP
  const setData     = isAdminTab ? setAdmins  : isAgencyTab ? setAgencies : setResps
  const apiPath     = isAdminTab ? '/admins'  : isAgencyTab ? '/agencies' : '/responders'

  const filtered = data.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.contact_number ?? '').includes(search)
  )

  function switchTab(t) {
    setTab(t); setShowAdd(false); setEditId(null); setSearch(''); setError('')
  }

  function openAdd() {
    setEditId(null)
    setForm({ ...blank, province: prov ?? '', municipality: isAdminTab ? (muni ?? '') : (muni ?? '') })
    setError(''); setShowAdd(true)
  }

  function openEdit(row) {
    setShowAdd(false)
    setEditId(row.id)
    setForm({
      name: row.name, contact_number: row.contact_number ?? '',
      province: row.province ?? '', municipality: row.municipality ?? '',
      ...(isAdminTab
        ? { gmail: row.gmail ?? '' }
        : isAgencyTab
          ? { agency_type: row.agency_type ?? 'mdrrmo' }
          : {
              gmail: row.gmail ?? '',
              barangay: row.barangay ?? '', team_id: row.team_id ?? '', unit_name: row.unit_name ?? '',
              assigned_zone: row.assigned_zone ?? '', assigned_barangay: row.assigned_barangay ?? '',
            }),
      password: '', status: row.status ?? 'active',
    })
    setError('')
  }

  function closeForm() { setShowAdd(false); setEditId(null); setError('') }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (isAdminTab && !form.contact_number.trim()) { setError('Contact number is required'); return }
    if (isAdminTab && !form.municipality) { setError('Municipality is required'); return }
    if (showAdd && !form.password) { setError('Password is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (showAdd) {
        const res = await api.post(apiPath, payload)
        setData(prev => [...prev, { ...payload, id: res.id, created_at: new Date().toISOString() }])
      } else {
        await api.put(`${apiPath}/${editId}`, payload)
        setData(prev => prev.map(r => r.id === editId ? { ...r, ...payload } : r))
      }
      closeForm()
    } catch (e) {
      setError(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`${apiPath}/${row.id}`)
      setData(prev => prev.filter(r => r.id !== row.id))
    } catch (e) {
      alert(e?.message ?? 'Delete failed')
    }
  }

  const tabLabel = isAdminTab ? 'admin' : isAgencyTab ? 'agency' : 'responder'

  return (
    <div className="p-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabBtn active={isAdminTab}             icon={UserCog}    label="Admin"      onClick={() => switchTab('admins')} />
        <TabBtn active={isAgencyTab}            icon={ShieldCheck} label="Agencies"  onClick={() => switchTab('agencies')} />
        <TabBtn active={!isAdminTab && !isAgencyTab} icon={Radio} label="Responders" onClick={() => switchTab('responders')} />
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <Chip label="Total"    value={data.length}                                    color="#00d4ff" />
        <Chip label="Active"   value={data.filter(r => r.status === 'active').length} color="#22c55e" />
        <Chip label="Inactive" value={data.filter(r => r.status !== 'active').length} color="#9ca3af" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <GlassInput placeholder={`Search ${tabLabel}…`} icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <NeonButton size="sm" onClick={openAdd}>
          <Plus size={13} className="mr-1.5" />
          Add {isAdminTab ? 'Admin' : isAgencyTab ? 'Agency' : 'Responder'}
        </NeonButton>
      </div>

      {/* Add form */}
      {showAdd && (
        <StaffForm
          isAdmin={isAdminTab} isAgency={isAgencyTab} isEdit={false}
          title={`New ${isAdminTab ? 'Admin Account' : isAgencyTab ? 'Agency' : 'Responder'}`}
          form={form} setForm={setForm}
          showPw={showPw} setShowPw={setShowPw}
          error={error} saving={saving}
          onSave={handleSave} onCancel={closeForm}
          prov={prov}
        />
      )}

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {isAdminTab
            ? <AdminTable rows={filtered} loading={loading} editId={editId} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onEdit={openEdit} onDelete={handleDelete} onSave={handleSave} onCancel={closeForm} prov={prov} />
            : isAgencyTab
              ? <AgencyTable rows={filtered} loading={loading} editId={editId} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onEdit={openEdit} onDelete={handleDelete} onSave={handleSave} onCancel={closeForm} prov={prov} />
              : <ResponderTable rows={filtered} loading={loading} editId={editId} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onEdit={openEdit} onDelete={handleDelete} onSave={handleSave} onCancel={closeForm} prov={prov} />
          }
        </div>
      </div>
      <p className="text-xs text-slate-600 text-right">{filtered.length} of {data.length} {tabLabel}s</p>
    </div>
  )
}

function AgencyTypeBadge({ type }) {
  const info = AGENCY_TYPES.find(t => t.value === type)
  if (!info) return <span className="text-xs text-slate-500">{type ?? '—'}</span>
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: `${info.color}18`, color: info.color, border: `1px solid ${info.color}44` }}>
      {info.label}
    </span>
  )
}

function AdminTable({ rows, loading, editId, form, setForm, showPw, setShowPw, error, saving, onEdit, onDelete, onSave, onCancel, prov }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[rgba(255,255,255,0.06)]">
          {['Name', 'Municipality', 'Contact', 'Status', 'Actions'].map(h => (
            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
          : rows.length === 0
            ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No admin accounts found</td></tr>
            : rows.map(row => (
                <>
                  <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      <div className="flex items-center gap-2"><UserCog size={13} className="text-[#00d4ff]" />{row.name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{row.municipality ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.contact_number ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3"><RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} /></td>
                  </tr>
                  {editId === row.id && (
                    <tr key={`edit-${row.id}`} className="bg-[rgba(0,212,255,0.03)]">
                      <td colSpan={5} className="px-4 py-3">
                        <StaffForm isAdmin isAgency={false} isEdit title={`Edit — ${row.name}`} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onSave={onSave} onCancel={onCancel} prov={prov} />
                      </td>
                    </tr>
                  )}
                </>
              ))
        }
      </tbody>
    </table>
  )
}

function AgencyTable({ rows, loading, editId, form, setForm, showPw, setShowPw, error, saving, onEdit, onDelete, onSave, onCancel, prov }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[rgba(255,255,255,0.06)]">
          {['Name', 'Agency Type', 'Municipality', 'Status', 'Actions'].map(h => (
            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
          : rows.length === 0
            ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No agencies found</td></tr>
            : rows.map(row => (
                <>
                  <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      <div className="flex items-center gap-2"><ShieldCheck size={13} className="text-[#22c55e]" />{row.name}</div>
                    </td>
                    <td className="px-4 py-3"><AgencyTypeBadge type={row.agency_type} /></td>
                    <td className="px-4 py-3 text-xs text-slate-300">{row.municipality ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3"><RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} /></td>
                  </tr>
                  {editId === row.id && (
                    <tr key={`edit-${row.id}`} className="bg-[rgba(34,197,94,0.03)]">
                      <td colSpan={5} className="px-4 py-3">
                        <StaffForm isAdmin={false} isAgency isEdit title={`Edit — ${row.name}`} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onSave={onSave} onCancel={onCancel} prov={prov} />
                      </td>
                    </tr>
                  )}
                </>
              ))
        }
      </tbody>
    </table>
  )
}

function ResponderTable({ rows, loading, editId, form, setForm, showPw, setShowPw, error, saving, onEdit, onDelete, onSave, onCancel, prov }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[rgba(255,255,255,0.06)]">
          {['Name', 'Unit / Team', 'Zone', 'Barangay', 'Duty', 'Relay', 'Actions'].map(h => (
            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
          : rows.length === 0
            ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No responders found</td></tr>
            : rows.map(row => (
                <>
                  <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      <div className="flex items-center gap-2"><Radio size={13} className="text-[#22c55e]" />{row.name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.unit_name ?? '—'} {row.team_id ? `(${row.team_id})` : ''}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.assigned_zone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{row.assigned_barangay ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.duty_status === 'on_duty' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(107,114,128,0.1)] text-[#9ca3af]'}`}>
                        {row.duty_status === 'on_duty' ? 'On Duty' : 'Standby'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${row.active_mesh_relay ? 'text-[#00d4ff]' : 'text-slate-600'}`}>
                        {row.active_mesh_relay ? '● Active' : '○ Off'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} /></td>
                  </tr>
                  {editId === row.id && (
                    <tr key={`edit-${row.id}`} className="bg-[rgba(34,197,94,0.03)]">
                      <td colSpan={7} className="px-4 py-3">
                        <StaffForm isAdmin={false} isAgency={false} isEdit title={`Edit — ${row.name}`} form={form} setForm={setForm} showPw={showPw} setShowPw={setShowPw} error={error} saving={saving} onSave={onSave} onCancel={onCancel} prov={prov} />
                      </td>
                    </tr>
                  )}
                </>
              ))
        }
      </tbody>
    </table>
  )
}

function StaffForm({ isAdmin, isAgency, isEdit, title, form, setForm, showPw, setShowPw, error, saving, onSave, onCancel, prov }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <GlassCard>
      <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <GlassInput label="Full Name *"    value={form.name}           onChange={e => set('name', e.target.value)}           placeholder="Full Name" />
        <GlassInput label={`Contact Number${isAdmin ? ' *' : ''}`} value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
        {isAgency && (
          <GlassSelect label="Agency Type *" value={form.agency_type ?? 'mdrrmo'} onChange={e => set('agency_type', e.target.value)}>
            {AGENCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </GlassSelect>
        )}
        {(isAdmin || !isAgency) && (
          <GlassInput label="Gmail" value={form.gmail ?? ''} onChange={e => set('gmail', e.target.value)} placeholder="user@gmail.com" />
        )}
        <GlassSelect label="Province" value={form.province} onChange={e => set('province', e.target.value)} disabled>
          <option value="">Select Province</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </GlassSelect>
        <GlassSelect label={`Municipality${isAdmin ? ' *' : ''}`} value={form.municipality} onChange={e => set('municipality', e.target.value)} disabled={!isAdmin}>
          <option value="">Select Municipality</option>
          {getMunicipalities(form.province || prov || '').map(m => <option key={m} value={m}>{m}</option>)}
        </GlassSelect>
        {!isAgency && !isAdmin && <>
          <GlassSelect label="Barangay" value={form.barangay ?? ''} onChange={e => set('barangay', e.target.value)}>
            <option value="">Select Barangay</option>
            {getBarangays(form.municipality).map(b => <option key={b} value={b}>{b}</option>)}
          </GlassSelect>
          <GlassInput label="Team ID"           value={form.team_id ?? ''}          onChange={e => set('team_id', e.target.value)}          placeholder="TEAM-A" />
          <GlassInput label="Unit Name"         value={form.unit_name ?? ''}        onChange={e => set('unit_name', e.target.value)}        placeholder="Alpha Unit" />
          <GlassInput label="Assigned Zone"     value={form.assigned_zone ?? ''}    onChange={e => set('assigned_zone', e.target.value)}    placeholder="Zone 1 – Lipata" />
          <GlassInput label="Assigned Barangay" value={form.assigned_barangay ?? ''} onChange={e => set('assigned_barangay', e.target.value)} placeholder="Lipata" />
        </>}
        <div className="relative">
          <GlassInput
            label={isEdit ? 'New Password (blank = no change)' : 'Password *'}
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-8 text-slate-400 hover:text-white">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {isEdit && (
          <GlassSelect label="Status" value={form.status ?? 'active'} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </GlassSelect>
        )}
      </div>
      {error && <p className="text-xs text-[#ef4444] mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <NeonButton size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</NeonButton>
        <NeonButton variant="ghost" size="sm" onClick={onCancel}>Cancel</NeonButton>
      </div>
    </GlassCard>
  )
}

function TabBtn({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-[rgba(0,212,255,0.12)] text-[#00d4ff] border border-[rgba(0,212,255,0.2)]'
          : 'text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
      }`}>
      <Icon size={14} />
      {label}
    </button>
  )
}

function StatusBadge({ status }) {
  const map = {
    active:   { bg: 'bg-[rgba(34,197,94,0.1)]',   text: 'text-[#22c55e]', label: 'Active'   },
    inactive: { bg: 'bg-[rgba(107,114,128,0.1)]', text: 'text-[#9ca3af]', label: 'Inactive' },
  }
  const s = map[status] ?? map.inactive
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onEdit}
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors">
        <Pencil size={13} />
      </button>
      <button onClick={onDelete}
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
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
