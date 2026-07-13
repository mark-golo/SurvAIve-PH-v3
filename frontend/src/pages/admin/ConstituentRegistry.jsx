import { useState, useEffect } from 'react'
import { Search, Download, Plus, UserCheck, Pencil, Trash2 } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { NeonButton } from '../../components/ui/NeonButton'
import { GlassInput, GlassSelect } from '../../components/ui/GlassInput'
import { GlassCard } from '../../components/ui/GlassCard'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { getBarangays } from '../../lib/philippineLocations'

const STATUS_COLORS = {
  active:   { bg: 'bg-[rgba(34,197,94,0.1)]',  text: 'text-[#22c55e]',  label: 'Active'   },
  sos_sent: { bg: 'bg-[rgba(239,68,68,0.1)]',  text: 'text-[#ef4444]',  label: 'SOS Sent' },
  rescued:  { bg: 'bg-[rgba(0,212,255,0.1)]',  text: 'text-[#00d4ff]',  label: 'Rescued'  },
  unknown:  { bg: 'bg-[rgba(107,114,128,0.1)]',text: 'text-[#9ca3af]',  label: 'Unknown'  },
}

export function ConstituentRegistry() {
  const { scope } = useAuthStore()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState({ name: '', contact_number: '', barangay: '', household_count: 1 })
  const [saving, setSaving] = useState(false)

  const muni = scope?.municipality
  useEffect(() => {
    api.get(muni ? `/constituents?municipality=${encodeURIComponent(muni)}` : '/constituents')
      .then(rows => setData(rows.map(r => ({
        id: r.id,
        name: r.name,
        contact: r.contact_number,
        barangay: r.barangay,
        household: r.household_count,
        status: r.status,
        verified: !!r.is_verified,
        vulnerabilities: r.vulnerabilities ?? [],
        account_status: r.account_status,   // null | 'active' | 'inactive'
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  function openEdit(c) {
    setShowAdd(false)
    setEditId(c.id)
    setEditForm({
      name: c.name, contact_number: c.contact, barangay: c.barangay,
      household_count: c.household, status: c.status,
      account_active: c.account_status !== null ? c.account_status !== 'inactive' : null,
    })
  }

  async function handleUpdate() {
    setSaving(true)
    try {
      await api.put(`/constituents/${editId}`, editForm)
      setData(prev => prev.map(r => r.id === editId
        ? { ...r, name: editForm.name, contact: editForm.contact_number, barangay: editForm.barangay,
            household: Number(editForm.household_count), status: editForm.status,
            account_status: editForm.account_active === null ? null : (editForm.account_active ? 'active' : 'inactive') }
        : r))
      setEditId(null)
    } catch { /* silently keep state */ }
    finally { setSaving(false) }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Remove "${c.name}" from the registry? This cannot be undone.`)) return
    try {
      await api.delete(`/constituents/${c.id}`)
      setData(prev => prev.filter(r => r.id !== c.id))
    } catch { alert('Delete failed. Please try again.') }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/constituents', { ...addForm, municipality: muni })
      setData(prev => [...prev, { id: res.id, name: addForm.name, contact: addForm.contact_number, barangay: addForm.barangay, household: Number(addForm.household_count), status: 'active', verified: false, vulnerabilities: [] }])
      setAddForm({ name: '', contact_number: '', barangay: '', household_count: 1 })
      setShowAdd(false)
    } catch { /* keep form open */ }
    finally { setSaving(false) }
  }

  const filtered = data.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.barangay.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  const summary = {
    total: data.length,
    sos: data.filter(c => c.status === 'sos_sent').length,
    rescued: data.filter(c => c.status === 'rescued').length,
    unknown: data.filter(c => c.status === 'unknown').length,
  }

  if (loading) return (
    <AdminLayout title="Constituent Registry">
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading constituents…</div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Constituent Registry">
      <div className="p-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryChip label="Registered"   value={summary.total}   color="#00d4ff" />
          <SummaryChip label="SOS Sent"     value={summary.sos}     color="#ef4444" />
          <SummaryChip label="Rescued"      value={summary.rescued} color="#22c55e" />
          <SummaryChip label="Status Unknown" value={summary.unknown} color="#9ca3af" />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <GlassInput placeholder="Search name or barangay…" icon={Search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <GlassSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="sos_sent">SOS Sent</option>
            <option value="rescued">Rescued</option>
            <option value="unknown">Unknown</option>
          </GlassSelect>
          <NeonButton variant="ghost" size="sm" onClick={() => alert('Export CSV – would download barangay registry')}>
            <Download size={13} className="mr-1.5" />
            Export CSV
          </NeonButton>
          <NeonButton size="sm" onClick={() => { setShowAdd(v => !v); setEditId(null) }}>
            <Plus size={13} className="mr-1.5" />
            Manual Entry
          </NeonButton>
        </div>

        {/* Manual entry form */}
        {showAdd && (
          <GlassCard>
            <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Add Constituent (No Smartphone)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GlassInput label="Full Name *"     value={addForm.name}           onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}           placeholder="Juan Dela Cruz" />
              <GlassInput label="Contact Number"  value={addForm.contact_number} onChange={e => setAddForm(p => ({ ...p, contact_number: e.target.value }))} placeholder="09XXXXXXXXX" />
              <GlassSelect label="Barangay *" value={addForm.barangay} onChange={e => setAddForm(p => ({ ...p, barangay: e.target.value }))}>
                <option value="">Select Barangay</option>
                {getBarangays(muni).map(b => <option key={b} value={b}>{b}</option>)}
              </GlassSelect>
              <GlassInput label="Household Count" value={addForm.household_count} type="number" onChange={e => setAddForm(p => ({ ...p, household_count: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-3">
              <NeonButton size="sm" onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</NeonButton>
              <NeonButton variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</NeonButton>
            </div>
          </GlassCard>
        )}

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {['Name', 'Contact', 'Barangay', 'Household', 'Vulnerabilities', 'Status', 'Account', 'Verified', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.unknown
                  return (
                    <>
                      <tr key={c.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="px-4 py-3 text-sm font-medium text-white">{c.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{c.contact}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{c.barangay}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{c.household}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.vulnerabilities.length > 0
                              ? c.vulnerabilities.map(v => (
                                  <span key={v} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]">{v}</span>
                                ))
                              : <span className="text-xs text-slate-600">None</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.account_status === 'inactive' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(239,68,68,0.15)] text-[#ef4444]">Disabled</span>
                          )}
                          {c.account_status === 'active' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(34,197,94,0.12)] text-[#22c55e]">Active</span>
                          )}
                          {c.account_status === null && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(107,114,128,0.1)] text-[#9ca3af]">No Account</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.verified
                            ? <span className="text-[11px] text-[#00d4ff] font-medium flex items-center gap-1"><UserCheck size={11} /> Verified</span>
                            : <span className="text-[11px] text-[#f59e0b]">Admin-Entered</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)] transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editId === c.id && (
                        <tr key={`edit-${c.id}`} className="bg-[rgba(0,212,255,0.03)]">
                          <td colSpan={9} className="px-4 py-3">
                            <GlassCard>
                              <p className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Edit — {c.name}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <GlassInput label="Full Name"      value={editForm.name}           onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                                <GlassInput label="Contact Number" value={editForm.contact_number} onChange={e => setEditForm(p => ({ ...p, contact_number: e.target.value }))} />
                                <GlassSelect label="Barangay" value={editForm.barangay ?? ''} onChange={e => setEditForm(p => ({ ...p, barangay: e.target.value }))}>
                                  <option value="">Select Barangay</option>
                                  {getBarangays(muni).map(b => <option key={b} value={b}>{b}</option>)}
                                </GlassSelect>
                                <GlassInput label="Household Count" type="number" value={editForm.household_count} onChange={e => setEditForm(p => ({ ...p, household_count: e.target.value }))} />
                                <GlassSelect label="Status" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                                  <option value="active">Active</option>
                                  <option value="sos_sent">SOS Sent</option>
                                  <option value="rescued">Rescued</option>
                                  <option value="unknown">Unknown</option>
                                </GlassSelect>
                              </div>
                              {editForm.account_active !== null && (
                                <div className="flex items-center justify-between mt-3 p-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                                  <span className="text-xs text-slate-400">Account Login Access</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditForm(f => ({ ...f, account_active: !f.account_active }))}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                      editForm.account_active
                                        ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]'
                                        : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] hover:bg-[rgba(34,197,94,0.15)] hover:text-[#22c55e]'
                                    }`}
                                  >
                                    {editForm.account_active ? 'Enabled — click to Disable' : 'Disabled — click to Enable'}
                                  </button>
                                </div>
                              )}
                              <div className="flex gap-2 mt-3">
                                <NeonButton size="sm" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving…' : 'Update'}</NeonButton>
                                <NeonButton variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</NeonButton>
                              </div>
                            </GlassCard>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-600 text-right">{filtered.length} of {data.length} constituents</p>
      </div>
    </AdminLayout>
  )
}

function SummaryChip({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}
