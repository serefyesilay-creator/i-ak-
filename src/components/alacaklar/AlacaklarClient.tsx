'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import {
  Plus, Wallet, ChevronLeft, ChevronRight, Trash2, X,
  CheckCircle2, Circle, Clock, CreditCard, History,
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Client, Invoice, Payment } from '@/types'

interface Props {
  initialClients: Client[]
  initialInvoices: Invoice[]
}

const currencySymbol: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' }

const statusConfig = {
  unpaid:  { label: 'Bekliyor', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  partial: { label: 'Kısmi',    color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  overdue: { label: 'Gecikmiş', color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
  paid:    { label: 'Ödendi',   color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  },
}

export default function AlacaklarClient({ initialClients, initialInvoices }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [showClientModal, setShowClientModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState<Invoice | null>(null)
  const [userId, setUserId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useRealtime<Client>({
    table: 'clients', userId,
    onInsert: (row) => setClients(prev => prev.some(c => c.id === row.id) ? prev : [...prev, row]),
    onUpdate: (row) => setClients(prev => prev.map(c => c.id === row.id ? row : c)),
    onDelete: (id) => setClients(prev => prev.filter(c => c.id !== id)),
  })

  useRealtime<Invoice>({
    table: 'invoices', userId,
    onInsert: (row) => setInvoices(prev => prev.some(i => i.id === row.id) ? prev : [row, ...prev]),
    onUpdate: (row) => setInvoices(prev => prev.map(i => i.id === row.id ? row : i)),
    onDelete: (id) => setInvoices(prev => prev.filter(i => i.id !== id)),
  })

  const monthInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.due_date) return false
      return isSameMonth(new Date(inv.due_date), currentMonth)
    })
  }, [invoices, currentMonth])

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
    const parsedAmount = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(parsedAmount)) { toast.error('Geçersiz tutar'); return }
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id, client_id: clientId,
        service_name: form.service_name, amount: parsedAmount,
        currency: form.currency, status: 'unpaid',
        due_date: form.due_date || null, notes: form.notes || null,
      })
      .select().single()
    if (error) { toast.error('Eklenemedi: ' + error.message); return }
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

  function updateInvoiceLocal(updated: Invoice) {
    setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Alacaklar</h1>
        <button
          onClick={() => setShowClientModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> Müşteri Ekle
        </button>
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
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{monthSummary.count} fatura</div>
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

              <div style={{ padding: '8px 12px' }}>
                {clientInvoices.map(inv => {
                  const sym = currencySymbol[inv.currency] ?? '₺'
                  const sc = statusConfig[inv.status] ?? statusConfig.unpaid
                  return (
                    <div
                      key={inv.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: '1px solid var(--border)' }}
                    >
                      {/* Status Icon — tıkla: ödendi/bekliyor toggle */}
                      <button
                        onClick={() => togglePaid(inv)}
                        title={inv.status === 'paid' ? 'Ödenmedi olarak işaretle' : 'Ödendi olarak işaretle'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'transform 0.15s' }}
                      >
                        {inv.status === 'paid'
                          ? <CheckCircle2 size={22} color="#22C55E" />
                          : inv.status === 'partial'
                          ? <Clock size={22} color="#6366F1" />
                          : inv.status === 'overdue'
                          ? <Circle size={22} color="#EF4444" />
                          : <Circle size={22} color="#F59E0B" />}
                      </button>

                      {/* Invoice Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 500,
                          color: inv.status === 'paid' ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: inv.status === 'paid' ? 'line-through' : 'none',
                          opacity: inv.status === 'paid' ? 0.7 : 1,
                        }}>
                          {inv.service_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 4, backgroundColor: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                          {inv.due_date && (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {format(new Date(inv.due_date), 'd MMM', { locale: tr })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: inv.status === 'paid' ? '#22C55E' : sc.color, whiteSpace: 'nowrap' }}>
                        {sym}{Number(inv.amount).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                      </div>

                      {/* Payment Button */}
                      <button
                        onClick={() => setShowPaymentModal(inv)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.6 }}
                        title="Ödeme takibi"
                      >
                        <CreditCard size={15} />
                      </button>

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

      {/* Clients with no invoices this month */}
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

      {/* Modals */}
      {showClientModal && <ClientModal onClose={() => setShowClientModal(false)} onAdd={addClient} />}
      {showInvoiceModal && (
        <InvoiceModal
          clientId={showInvoiceModal}
          clientName={clients.find(c => c.id === showInvoiceModal)?.name ?? ''}
          defaultMonth={currentMonth}
          onClose={() => setShowInvoiceModal(null)}
          onAdd={addInvoice}
        />
      )}
      {showPaymentModal && (
        <PaymentModal
          invoice={showPaymentModal}
          onClose={() => setShowPaymentModal(null)}
          onInvoiceUpdate={updateInvoiceLocal}
        />
      )}
    </div>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ invoice, onClose, onInvoiceUpdate }: {
  invoice: Invoice
  onClose: () => void
  onInvoiceUpdate: (inv: Invoice) => void
}) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const sym = currencySymbol[invoice.currency] ?? '₺'
  const total = Number(invoice.amount)

  useEffect(() => {
    supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('paid_at', { ascending: false })
      .then(({ data }) => {
        setPayments(data ?? [])
        setLoading(false)
      })
  }, [invoice.id])

  const paidTotal = useMemo(() => payments.reduce((s, p) => s + Number(p.amount), 0), [payments])
  const remaining = total - paidTotal

  async function addPayment() {
    const parsed = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) { toast.error('Geçersiz tutar'); return }
    if (parsed > remaining + 0.01) { toast.error(`Kalan: ${sym}${remaining.toLocaleString('tr-TR')}`); return }
    setSaving(true)

    const { data, error } = await supabase
      .from('payments')
      .insert({ invoice_id: invoice.id, amount: parsed, paid_at: paidAt, note: note || null })
      .select().single()

    if (error) { toast.error('Eklenemedi'); setSaving(false); return }

    const newPayments = [data, ...payments]
    setPayments(newPayments)
    setAmount('')
    setNote('')

    // Update invoice status
    const newPaid = newPayments.reduce((s, p) => s + Number(p.amount), 0)
    const newStatus: Invoice['status'] = newPaid >= total - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id)
    onInvoiceUpdate({ ...invoice, status: newStatus })

    toast.success('Ödeme eklendi')
    setSaving(false)
  }

  async function deletePayment(pid: string) {
    const { error } = await supabase.from('payments').delete().eq('id', pid)
    if (error) { toast.error('Silinemedi'); return }
    const newPayments = payments.filter(p => p.id !== pid)
    setPayments(newPayments)
    const newPaid = newPayments.reduce((s, p) => s + Number(p.amount), 0)
    const newStatus: Invoice['status'] = newPaid >= total - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id)
    onInvoiceUpdate({ ...invoice, status: newStatus })
    toast.success('Ödeme silindi')
  }

  const progressPct = Math.min(100, Math.round((paidTotal / total) * 100))

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Ödeme Takibi</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{invoice.service_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {/* Progress */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#22C55E' }}>
                {sym}{paidTotal.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 6 }}>
                / {sym}{total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: progressPct === 100 ? '#22C55E' : 'var(--accent)' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: progressPct === 100 ? '#22C55E' : 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          {remaining > 0.01 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              Kalan: {sym}{remaining.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
          )}
        </div>

        {/* Add Payment */}
        {remaining > 0.01 && (
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Yeni Ödeme</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={ls}>Tutar ({invoice.currency})</label>
                <input
                  className="input"
                  placeholder={`${sym}${remaining.toLocaleString('tr-TR')}`}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPayment()}
                />
              </div>
              <div>
                <label style={ls}>Tarih</label>
                <input type="date" className="input" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={ls}>Not (opsiyonel)</label>
              <input className="input" placeholder="Havale, nakit vb." value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <button
              onClick={addPayment}
              disabled={saving || !amount.trim()}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving || !amount.trim() ? 'not-allowed' : 'pointer', opacity: saving || !amount.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Kaydediliyor…' : 'Ödeme Ekle'}
            </button>
          </div>
        )}

        {/* Payment History */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <History size={14} color="var(--text-secondary)" />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ödeme Geçmişi
            </p>
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>Yükleniyor…</p>
          ) : payments.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>Henüz ödeme yok.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: 8 }}>
                  <CheckCircle2 size={16} color="#22C55E" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sym}{Number(p.amount).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {format(new Date(p.paid_at), 'd MMMM yyyy', { locale: tr })}
                      {p.note && ` — ${p.note}`}
                    </div>
                  </div>
                  <button
                    onClick={() => deletePayment(p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.5 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Client Modal ─────────────────────────────────────────────────────────────

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
            <button onClick={() => {
              if (!name.trim()) { toast.error('Müşteri adı zorunludur'); return }
              onAdd(name.trim(), company.trim())
            }} style={{ flex: 2, padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────

function InvoiceModal({ clientId, clientName, defaultMonth, onClose, onAdd }: {
  clientId: string; clientName: string; defaultMonth: Date
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
              <input type="text" inputMode="decimal" className="input" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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
            <button onClick={() => {
              if (!form.service_name.trim()) { toast.error('Hizmet adı zorunludur'); return }
              if (!form.amount.trim()) { toast.error('Tutar zorunludur'); return }
              onAdd(clientId, form)
            }} style={{ flex: 2, padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }
