'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Wallet, ChevronLeft, ChevronRight, Trash2, X, CheckCircle2, Circle } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Client, Invoice } from '@/types'

interface Props {
  initialClients: Client[]
  initialInvoices: Invoice[]
}

const currencySymbol: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' }

export default function AlacaklarClient({ initialClients, initialInvoices }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [showClientModal, setShowClientModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState<string | null>(null)
  const supabase = createClient()

  // Filter invoices for current month
  const monthInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.due_date) return false
      return isSameMonth(new Date(inv.due_date), currentMonth)
    })
  }, [invoices, currentMonth])

  // Summary for current month
  const monthSummary = useMemo(() => {
    let total = 0, paid = 0, pending = 0
    monthInvoices.forEach(inv => {
      const amount = Number(inv.amount)
      total += amount
      if (inv.status === 'paid') paid += amount
      else pending += amount
    })
    return { total, paid, pending, count: monthInvoices.length }
  }, [monthInvoices])

  // Group invoices by client
  const clientGroups = useMemo(() => {
    const groups: Record<string, { client: Client; invoices: Invoice[] }> = {}
    monthInvoices.forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      if (!client) return
      if (!groups[client.id]) groups[client.id] = { client, invoices: [] }
      groups[client.id].invoices.push(inv)
    })
    return Object.values(groups)
  }, [monthInvoices, clients])

  async function togglePaid(inv: Invoice) {
    const nextStatus = inv.status === 'paid' ? 'unpaid' : 'paid'
    const { error } = await supabase.from('invoices').update({ status: nextStatus }).eq('id', inv.id)
    if (error) { toast.error('Hata'); return }
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: nextStatus as Invoice['status'] } : i))
    toast.success(nextStatus === 'paid' ? '✅ Ödeme alındı!' : 'Ödeme bekliyor olarak işaretlendi')
  }

  async function addClient(name: string, company: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('clients')
      .insert({ user_id: user.id, name, company: company || null })
      .select().single()
    if (error) { toast.error('Eklenemedi'); return }
    setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    toast.success('Müşteri eklendi')
    setShowClientModal(false)
  }

  async function addInvoice(clientId: string, form: {
    service_name: string; amount: string; currency: string; due_date: string; notes: string
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: clientId,
        service_name: form.service_name,
        amount: parseFloat(form.amount),
        currency: form.currency,
        status: 'unpaid',
        due_date: form.due_date || null,
        notes: form.notes || null,
      })
      .select().single()
    if (error) { toast.error('Eklenemedi'); return }
    setInvoices(prev => [data, ...prev])
    toast.success('Fatura eklendi')
    setShowInvoiceModal(null)
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setInvoices(prev => prev.filter(i => i.id !== id))
    toast.success('Fatura silindi')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Alacaklar</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowClientModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> Müşteri Ekle
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 6 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: tr })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {monthSummary.count} fatura
          </div>
        </div>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 6 }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Month Summary */}
      {monthSummary.count > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              ₺{monthSummary.total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Toplam</div>
          </div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              ₺{monthSummary.paid.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Alınan</div>
          </div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>
              ₺{monthSummary.pending.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Bekleyen</div>
          </div>
        </div>
      )}

      {/* Client Groups */}
      {clientGroups.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Wallet size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>
            {clients.length === 0 ? 'Henüz müşteri yok' : 'Bu ay için fatura yok'}
          </p>
          {clients.length > 0 && (
            <p style={{ fontSize: 13, marginTop: 4 }}>Bir müşteriye fatura ekleyin veya ay değiştirin.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clientGroups.map(({ client, invoices: clientInvoices }) => (
            <div key={client.id} className="card" style={{ overflow: 'hidden' }}>
              {/* Client Header */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                  {client.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{client.name}</div>
                  {client.company && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{client.company}</div>}
                </div>
                <button
                  onClick={() => setShowInvoiceModal(client.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', backgroundColor: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  <Plus size={13} /> Fatura
                </button>
              </div>

              {/* Invoices */}
              <div style={{ padding: '8px 12px' }}>
                {clientInvoices.map(inv => {
                  const isPaid = inv.status === 'paid'
                  return (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 8px',
                        borderBottom: '1px solid var(--border)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Tick Button */}
                      <button
                        onClick={() => togglePaid(inv)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                          transition: 'transform 0.2s',
                        }}
                        title={isPaid ? 'Ödenmedi olarak işaretle' : 'Ödendi olarak işaretle'}
                      >
                        {isPaid
                          ? <CheckCircle2 size={22} color="#22C55E" />
                          : <Circle size={22} color="#F59E0B" />}
                      </button>

                      {/* Invoice Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 500,
                          color: isPaid ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: isPaid ? 'line-through' : 'none',
                          opacity: isPaid ? 0.7 : 1,
                          transition: 'all 0.2s',
                        }}>
                          {inv.service_name}
                        </div>
                        {inv.notes && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {inv.notes}
                          </div>
                        )}
                      </div>

                      {/* Amount */}
                      <div style={{
                        fontSize: 15, fontWeight: 700,
                        color: isPaid ? '#22C55E' : '#F59E0B',
                        transition: 'color 0.2s',
                        whiteSpace: 'nowrap',
                      }}>
                        {currencySymbol[inv.currency] ?? '₺'}
                        {Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                      </div>

                      {/* Due Date */}
                      {inv.due_date && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {format(new Date(inv.due_date), 'd MMM', { locale: tr })}
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => deleteInvoice(inv.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.5 }}
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Also show clients with no invoices this month */}
      {clients.filter(c => !clientGroups.find(g => g.client.id === c.id)).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Bu Ay Faturası Olmayan Müşteriler
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {clients.filter(c => !clientGroups.find(g => g.client.id === c.id)).map(client => (
              <button
                key={client.id}
                onClick={() => setShowInvoiceModal(client.id)}
                className="card"
                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', fontSize: 13 }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                  {client.name[0].toUpperCase()}
                </div>
                <span style={{ color: 'var(--text-primary)' }}>{client.name}</span>
                <Plus size={14} color="var(--accent)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Client Modal */}
      {showClientModal && <ClientModal onClose={() => setShowClientModal(false)} onAdd={addClient} />}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          clientId={showInvoiceModal}
          clientName={clients.find(c => c.id === showInvoiceModal)?.name ?? ''}
          defaultMonth={currentMonth}
          onClose={() => setShowInvoiceModal(null)}
          onAdd={addInvoice}
        />
      )}
    </div>
  )
}

function ClientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, company: string) => void }) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Yeni Müşteri</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={ls}>Ad Soyad *</label>
            <input className="input" placeholder="Müşteri adı" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={ls}>Şirket</label>
            <input className="input" placeholder="Şirket adı (opsiyonel)" value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>İptal</button>
            <button onClick={() => { if (name.trim()) onAdd(name.trim(), company.trim()) }} style={{ flex: 2, padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InvoiceModal({ clientId, clientName, defaultMonth, onClose, onAdd }: {
  clientId: string
  clientName: string
  defaultMonth: Date
  onClose: () => void
  onAdd: (clientId: string, form: { service_name: string; amount: string; currency: string; due_date: string; notes: string }) => void
}) {
  const defaultDate = format(defaultMonth, 'yyyy-MM-15')
  const [form, setForm] = useState({ service_name: '', amount: '', currency: 'TRY', due_date: defaultDate, notes: '' })

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Fatura Ekle</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{clientName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={ls}>Hizmet Adı *</label>
            <input className="input" placeholder="Aylık bakım, web sitesi vb." value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls}>Tutar *</label>
              <input type="number" className="input" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" />
            </div>
            <div>
              <label style={ls}>Para Birimi</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="TRY">TRY ₺</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>
          </div>
          <div>
            <label style={ls}>Son Ödeme Tarihi</label>
            <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div>
            <label style={ls}>Not</label>
            <input className="input" placeholder="Fatura notu (opsiyonel)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>İptal</button>
            <button onClick={() => { if (form.service_name.trim() && form.amount) onAdd(clientId, form) }} style={{ flex: 2, padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }
