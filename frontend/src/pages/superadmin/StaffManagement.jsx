import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, UserCog, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'

const BLANK_SA    = { name: '', contact_number: '', gmail: '', province: '', password: '' }
const BLANK_ADMIN = { name: '', contact_number: '', gmail: '', province: '', municipality: '', password: '', status: 'active' }

export function StaffManagement() {
  const [tab, setTab] = useState('superadmins')

  // ── Super Admins state ──
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [editRow, setEditRow]   = useState(null)
  const [form, setForm]         = useState(BLANK_SA)
  const [showPw, setShowPw]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // ── Admins state ──
  const [adminsData, setAdminsData]         = useState([])
  const [adminsLoading, setAdminsLoading]   = useState(true)
  const [adminSearch, setAdminSearch]       = useState('')
  const [adminShowAdd, setAdminShowAdd]     = useState(false)
  const [adminEditRow, setAdminEditRow]     = useState(null)
  const [adminForm, setAdminForm]           = useState(BLANK_ADMIN)
  const [adminShowPw, setAdminShowPw]       = useState(false)
  const [adminSaving, setAdminSaving]       = useState(false)
  const [adminError, setAdminError]         = useState('')

  useEffect(() => {
    api.get('/superadmins')
      .then(rows => setData(rows))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.get('/admins')
      .then(rows => setAdminsData(rows))
      .catch(() => setAdminsData([]))
      .finally(() => setAdminsLoading(false))
  }, [])

  // ── Super Admin handlers ──
  const filtered = data.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.contact_number ?? '').includes(search)
  )

  function openAdd() { setEditRow(null); setForm(BLANK_SA); setError(''); setShowAdd(true) }
  function openEdit(row) {
    setShowAdd(false); setEditRow(row.id)
    setForm({ name: row.name, contact_number: row.contact_number ?? '', gmail: row.gmail ?? '', province: row.province ?? '', password: '' })
    setError('')
  }
  function closeForm() { setShowAdd(false); setEditRow(null); setError('') }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (showAdd && !form.password) { setError('Password is required for new account'); return }
    setSaving(true); setError('')
    try {
      if (showAdd) {
        const res = await api.post('/superadmins', form)
        setData(prev => [...prev, { ...form, id: res.id, status: 'active', created_at: new Date().toISOString() }])
      } else {
        const payload = { ...form }
        if (!payload.password) delete payload.password
        await api.put(`/superadmins/${editRow}`, payload)
        setData(prev => prev.map(r => r.id === editRow ? { ...r, ...payload } : r))
      }
      closeForm()
    } catch (e) { setError(e?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/superadmins/${row.id}`)
      setData(prev => prev.filter(r => r.id !== row.id))
    } catch (e) { alert(e?.message ?? 'Delete failed') }
  }

  // ── Admin handlers ──
  const filteredAdmins = adminsData.filter(r =>
    !adminSearch ||
    r.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
    (r.contact_number ?? '').includes(adminSearch) ||
    (r.municipality ?? '').toLowerCase().includes(adminSearch.toLowerCase())
  )

  function openAdminAdd() { setAdminEditRow(null); setAdminForm(BLANK_ADMIN); setAdminError(''); setAdminShowAdd(true) }
  function openAdminEdit(row) {
    setAdminShowAdd(false); setAdminEditRow(row.id)
    setAdminForm({ name: row.name, contact_number: row.contact_number ?? '', gmail: row.gmail ?? '', province: row.province ?? '', municipality: row.municipality ?? '', password: '', status: row.status ?? 'active' })
    setAdminError('')
  }
  function closeAdminForm() { setAdminShowAdd(false); setAdminEditRow(null); setAdminError('') }

  async function handleAdminSave() {
    if (!adminForm.name.trim())           { setAdminError('Name is required'); return }
    if (!adminForm.contact_number.trim()) { setAdminError('Contact number is required'); return }
    if (!adminForm.municipality.trim())   { setAdminError('Municipality is required'); return }
    if (adminShowAdd && !adminForm.password) { setAdminError('Password is required for new account'); return }
    setAdminSaving(true); setAdminError('')
    try {
      if (adminShowAdd) {
        const res = await api.post('/admins', adminForm)
        setAdminsData(prev => [...prev, { ...adminForm, id: res.id, status: 'active', created_at: new Date().toISOString() }])
      } else {
        const payload = { ...adminForm }
        if (!payload.password) delete payload.password
        await api.put(`/admins/${adminEditRow}`, payload)
        setAdminsData(prev => prev.map(r => r.id === adminEditRow ? { ...r, ...payload } : r))
      }
      closeAdminForm()
    } catch (e) { setAdminError(e?.message ?? 'Save failed') }
    finally { setAdminSaving(false) }
  }

  async function handleAdminDelete(row) {
    if (!window.confirm(`Delete admin "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admins/${row.id}`)
      setAdminsData(prev => prev.filter(r => r.id !== row.id))
    } catch (e) { alert(e?.message ?? 'Delete failed') }
  }

  const summary = {
    total:    data.length,
    active:   data.filter(r => r.status === 'active').length,
    inactive: data.filter(r => r.status === 'inactive').length,
  }
  const adminSummary = {
    total:    adminsData.length,
    active:   adminsData.filter(r => r.status === 'active').length,
    inactive: adminsData.filter(r => r.status === 'inactive').length,
  }

  return (
    <SuperAdminLayout title="Staff Management">
      <div className="p-4 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 glass rounded-xl p-1 w-fit">
          {[['superadmins', 'Super Admins'], ['admins', 'Admins']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === key
                  ? 'bg-[rgba(139,92,246,0.2)] text-[#8b5cf6] border border-[rgba(139,92,246,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}>{label}</button>
          ))}
        </div>

        {/* ── SUPER ADMINS TAB ── */}
        {tab === 'superadmins' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Chip label="Total"    value={summary.total}    color="#8b5cf6" />
              <Chip label="Active"   value={summary.active}   color="#22c55e" />
              <Chip label="Inactive" value={summary.inactive} color="#9ca3af" />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <GlassInput placeholder="Search name or contact…" icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <NeonButton size="sm" onClick={openAdd}>
                <Plus size={13} className="mr-1.5" />
                Add Super Admin
              </NeonButton>
            </div>

            {showAdd && (
              <StaffForm
                title="New Super Admin"
                form={form} setForm={setForm}
                showPw={showPw} setShowPw={setShowPw}
                error={error} saving={saving}
                onSave={handleSave} onCancel={closeForm}
                isEdit={false}
              />
            )}

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      {['Name', 'Contact', 'Gmail', 'Province', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
                      : filtered.length === 0
                        ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No records found</td></tr>
                        : filtered.map(row => (
                            <>
                              <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                                <td className="px-4 py-3 text-sm font-medium text-white">
                                  <div className="flex items-center gap-2">
                                    <UserCog size={14} className="text-[#8b5cf6]" />
                                    {row.name}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.contact_number ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.gmail ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-300">{row.province ?? '—'}</td>
                                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.1)] transition-colors"><Pencil size={13} /></button>
                                    <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"><Trash2 size={13} /></button>
                                  </div>
                                </td>
                              </tr>
                              {editRow === row.id && (
                                <tr key={`edit-${row.id}`} className="bg-[rgba(139,92,246,0.04)]">
                                  <td colSpan={6} className="px-4 py-3">
                                    <StaffForm
                                      title={`Edit — ${row.name}`}
                                      form={form} setForm={setForm}
                                      showPw={showPw} setShowPw={setShowPw}
                                      error={error} saving={saving}
                                      onSave={handleSave} onCancel={closeForm}
                                      isEdit
                                    />
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
            <p className="text-xs text-slate-600 text-right">{filtered.length} of {data.length} super admins</p>
          </>
        )}

        {/* ── ADMINS TAB ── */}
        {tab === 'admins' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Chip label="Total"    value={adminSummary.total}    color="#00d4ff" />
              <Chip label="Active"   value={adminSummary.active}   color="#22c55e" />
              <Chip label="Inactive" value={adminSummary.inactive} color="#9ca3af" />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <GlassInput placeholder="Search name, contact, or municipality…" icon={Search} value={adminSearch} onChange={e => setAdminSearch(e.target.value)} />
              </div>
              <NeonButton size="sm" variant="blue" onClick={openAdminAdd}>
                <Plus size={13} className="mr-1.5" />
                Add Admin
              </NeonButton>
            </div>

            {adminShowAdd && (
              <StaffForm
                title="New Admin"
                form={adminForm} setForm={setAdminForm}
                showPw={adminShowPw} setShowPw={setAdminShowPw}
                error={adminError} saving={adminSaving}
                onSave={handleAdminSave} onCancel={closeAdminForm}
                isEdit={false}
                showMunicipality
              />
            )}

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      {['Name', 'Contact', 'Gmail', 'Province', 'Municipality', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminsLoading
                      ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>
                      : filteredAdmins.length === 0
                        ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No admins found</td></tr>
                        : filteredAdmins.map(row => (
                            <>
                              <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                                <td className="px-4 py-3 text-sm font-medium text-white">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-[#00d4ff]" />
                                    {row.name}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.contact_number ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{row.gmail ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-300">{row.province ?? '—'}</td>
                                <td className="px-4 py-3 text-xs text-[#00d4ff] font-medium">{row.municipality ?? '—'}</td>
                                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openAdminEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors"><Pencil size={13} /></button>
                                    <button onClick={() => handleAdminDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"><Trash2 size={13} /></button>
                                  </div>
                                </td>
                              </tr>
                              {adminEditRow === row.id && (
                                <tr key={`edit-${row.id}`} className="bg-[rgba(0,212,255,0.03)]">
                                  <td colSpan={7} className="px-4 py-3">
                                    <StaffForm
                                      title={`Edit Admin — ${row.name}`}
                                      form={adminForm} setForm={setAdminForm}
                                      showPw={adminShowPw} setShowPw={setAdminShowPw}
                                      error={adminError} saving={adminSaving}
                                      onSave={handleAdminSave} onCancel={closeAdminForm}
                                      isEdit
                                      showMunicipality
                                    />
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
            <p className="text-xs text-slate-600 text-right">{filteredAdmins.length} of {adminsData.length} admins</p>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}

function StaffForm({ title, form, setForm, showPw, setShowPw, error, saving, onSave, onCancel, isEdit, showMunicipality }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <GlassCard>
      <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <GlassInput label="Full Name *"      value={form.name}           onChange={e => set('name', e.target.value)}           placeholder="Juan dela Cruz" />
        <GlassInput label="Contact Number"   value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
        <GlassInput label="Gmail"            value={form.gmail}          onChange={e => set('gmail', e.target.value)}           placeholder="user@gmail.com" />
        <GlassInput label="Province"         value={form.province}       onChange={e => set('province', e.target.value)}        placeholder="Surigao del Norte" />
        {showMunicipality && (
          <GlassInput label="Municipality *" value={form.municipality}   onChange={e => set('municipality', e.target.value)}    placeholder="Del Carmen" />
        )}
        <div className="relative">
          <GlassInput
            label={isEdit ? 'New Password (leave blank to keep)' : 'Password *'}
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

function StatusBadge({ status }) {
  const map = {
    active:   { bg: 'bg-[rgba(34,197,94,0.1)]',   text: 'text-[#22c55e]', label: 'Active'   },
    inactive: { bg: 'bg-[rgba(107,114,128,0.1)]', text: 'text-[#9ca3af]', label: 'Inactive' },
  }
  const s = map[status] ?? map.inactive
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
}

function Chip({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}
