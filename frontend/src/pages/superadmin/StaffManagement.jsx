import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, UserCog, Eye, EyeOff } from 'lucide-react'
import { SuperAdminLayout } from './SuperAdminLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import { NeonButton } from '../../components/ui/NeonButton'
import api from '../../lib/api'

const BLANK = { name: '', contact_number: '', gmail: '', province: '', password: '' }

export function StaffManagement() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [editRow, setEditRow]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [showPw, setShowPw]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get('/superadmins')
      .then(rows => setData(rows))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.contact_number ?? '').includes(search)
  )

  function openAdd() {
    setEditRow(null)
    setForm(BLANK)
    setError('')
    setShowAdd(true)
  }

  function openEdit(row) {
    setShowAdd(false)
    setEditRow(row.id)
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
    } catch (e) {
      setError(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/superadmins/${row.id}`)
      setData(prev => prev.filter(r => r.id !== row.id))
    } catch (e) {
      alert(e?.message ?? 'Delete failed')
    }
  }

  const summary = {
    total:    data.length,
    active:   data.filter(r => r.status === 'active').length,
    inactive: data.filter(r => r.status === 'inactive').length,
  }

  return (
    <SuperAdminLayout title="Staff Management">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Chip label="Total"    value={summary.total}    color="#8b5cf6" />
          <Chip label="Active"   value={summary.active}   color="#22c55e" />
          <Chip label="Inactive" value={summary.inactive} color="#9ca3af" />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <GlassInput placeholder="Search name or contact…" icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <NeonButton size="sm" onClick={openAdd}>
            <Plus size={13} className="mr-1.5" />
            Add Super Admin
          </NeonButton>
        </div>

        {/* Add form */}
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

        {/* Table */}
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
                            <td className="px-4 py-3">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => openEdit(row)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.1)] transition-colors">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDelete(row)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                                  <Trash2 size={13} />
                                </button>
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
      </div>
    </SuperAdminLayout>
  )
}

function StaffForm({ title, form, setForm, showPw, setShowPw, error, saving, onSave, onCancel, isEdit }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <GlassCard>
      <p className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassInput label="Full Name *"      value={form.name}           onChange={e => set('name', e.target.value)}           placeholder="Juan dela Cruz" />
        <GlassInput label="Contact Number"   value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
        <GlassInput label="Gmail"            value={form.gmail}          onChange={e => set('gmail', e.target.value)}           placeholder="user@gmail.com" />
        <GlassInput label="Province"         value={form.province}       onChange={e => set('province', e.target.value)}        placeholder="Surigao del Norte" />
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
