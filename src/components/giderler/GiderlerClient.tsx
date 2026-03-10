'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import { Plus, TrendingDown, ChevronLeft, ChevronRight, Trash2, X, CheckCircle2, Circle } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Expense } from '@/types'

interface Props {
  initialExpenses: Expense[]
}

const CATEGORIES = ['Kira', 'Yazılım', 'Donanım', 'Pazarlama', 'Ofis', 'Fatura', 'Maaş', 'Vergi', 'Ulaşım', 'Yemek', 'Diğer']

const CATEGORY_COLORS: Record<string, string> = {
  'Kira': '#6366F1',
  'Yazılım': '#8B5CF6',
  'Donanım': '#3B82F6',
  'Pazarlama': '#EC4899',
  'Ofis': '#14B8A6',
  'Fatura': '#F59E0B',
  'Maaş': '#22C55E',
  'Vergi': '#EF4444',
  'Ulaşım': '#F97316',
  'Yemek': '#84CC16',
  'Diğer': '#6B7280',
}

const currencySymbol: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' }

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }

export default function GiderlerClient({ initialExpenses }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useRealtime<Expense>({
    table: 'expenses', userId,
    onInsert: (row) => setExpenses(prev => prev.some(e => e.id === row.id) ? prev : [row, ...prev]),
    onUpdate: (row) => setExpenses(prev => prev.map(e => e.id === row.id ? row : e)),
    onDelete: (id) => setExpenses(prev => prev.filter(e => e.id !== id)),
  })

  const monthExpenses = useMemo(() => {
    return expenses
      .filter(e => isSameMonth(new Date(e.expense_date), currentMonth))
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
  }, [expenses, currentMonth])

  const monthSummary = useMemo(() => {
    const total = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const paid = monthExpenses.filter(e => e.is_paid).reduce((s, e) => s + Number(e.amount), 0)
    const unpaid = total - paid
    const byCategory: Record<string, number> = {}
    monthExpenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
    })
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    return { total, paid, unpaid, byCategory: sorted }
  }, [monthExpenses])

  async function addExpense(form: {
    title: string; amount: string; currency: string; category: string; expense_date: string; notes: string
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const parsed = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) { toast.error('Geçersiz tutar'); return }
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        title: form.title,
        amount: parsed,
        currency: form.currency,
        category: form.category,
        expense_date: form.expense_date,
        notes: form.notes || null,
      })
      .select().single()
    if (error) { toast.error('Eklenemedi: ' + error.message); return }
    setExpenses(prev => [data, ...prev])
    toast.success('Gider eklendi')
    setShowModal(false)
  }

  async function togglePaid(expense: Expense) {
    const { error } = await supabase.from('expenses').update({ is_paid: !expense.is_paid }).eq('id', expense.id)
    if (error) { toast.error('Güncellenemedi'); return }
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, is_paid: !expense.is_paid } : e))
  }

  async function deleteExpense(id: string) {
    if (!confirm('Bu gideri silmek istiyor musunuz?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('Gider silindi')
  }

  const maxCat = monthSummary.byCategory[0]?.[1] ?? 1

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Giderler</h1>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> Gider Ekle
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
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{monthExpenses.length} gider</div>
        </div>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 6 }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {monthExpenses.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <TrendingDown size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Bu ay için gider yok</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Gider ekle butonuyla kayıt oluşturabilirsin.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {/* Total + Category Chart */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 20, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444' }}>
                ₺{monthSummary.total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {format(currentMonth, 'MMMM yyyy', { locale: tr })} toplam gider
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                  ✓ Ödendi: ₺{monthSummary.paid.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
                  ○ Bekliyor: ₺{monthSummary.unpaid.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {monthSummary.byCategory.map(([cat, amount]) => {
                const color = CATEGORY_COLORS[cat] ?? '#6B7280'
                const pct = Math.round((amount / monthSummary.total) * 100)
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cat}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct}%</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>
                        ₺{amount.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(amount / maxCat) * 100}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Expense List */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              Gider Listesi
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {monthExpenses.map(e => {
                const color = CATEGORY_COLORS[e.category] ?? '#6B7280'
                const sym = currencySymbol[e.currency] ?? '₺'
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)', opacity: e.is_paid ? 0.55 : 1 }}>
                    <button onClick={() => togglePaid(e)} title={e.is_paid ? 'Ödendi' : 'Ödenmedi'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: e.is_paid ? '#22C55E' : 'var(--text-secondary)', display: 'flex' }}>
                      {e.is_paid ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: e.is_paid ? 'line-through' : 'none' }}>{e.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, backgroundColor: `${color}20`, color, fontWeight: 600 }}>{e.category}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{format(new Date(e.expense_date), 'd MMM', { locale: tr })}</span>
                        {e.is_paid && <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Ödendi</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: e.is_paid ? '#22C55E' : '#EF4444', whiteSpace: 'nowrap' }}>
                      {sym}{Number(e.amount).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                    </span>
                    <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && <ExpenseModal currentMonth={currentMonth} onClose={() => setShowModal(false)} onAdd={addExpense} />}
    </div>
  )
}

// ─── Expense Modal ────────────────────────────────────────────────────────────

function ExpenseModal({ currentMonth, onClose, onAdd }: {
  currentMonth: Date
  onClose: () => void
  onAdd: (form: { title: string; amount: string; currency: string; category: string; expense_date: string; notes: string }) => void
}) {
  const defaultDate = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    title: '', amount: '', currency: 'TRY', category: 'Diğer', expense_date: defaultDate, notes: ''
  })
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!form.title.trim()) { toast.error('Başlık zorunludur'); return }
    if (!form.amount.trim()) { toast.error('Tutar zorunludur'); return }
    setSaving(true)
    await onAdd(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Gider Ekle</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={ls}>Başlık *</label>
            <input className="input" placeholder="Sunucu faturası, domain vb." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls}>Kategori</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={ls}>Tarih</label>
              <input type="date" className="input" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={ls}>Not (opsiyonel)</label>
            <input className="input" placeholder="Ek açıklama" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>İptal</button>
            <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '10px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Ekleniyor…' : 'Gider Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
