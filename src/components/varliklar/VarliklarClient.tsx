'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Check, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Asset, AssetCategory } from '@/types'

interface Props { initialAssets: Asset[] }

const CATEGORIES: AssetCategory[] = ['Altın', 'Döviz', 'Hisse', 'Kripto', 'Gayrimenkul', 'Tahvil', 'Duran Varlık', 'Diğer']

const CAT_COLORS: Record<string, string> = {
  'Altın': '#F59E0B',
  'Döviz': '#3B82F6',
  'Hisse': '#22C55E',
  'Kripto': '#8B5CF6',
  'Gayrimenkul': '#EC4899',
  'Tahvil': '#14B8A6',
  'Duran Varlık': '#D97706',
  'Diğer': '#6B7280',
}

const CAT_EMOJI: Record<string, string> = {
  'Altın': '🥇', 'Döviz': '💵', 'Hisse': '📈', 'Kripto': '🪙',
  'Gayrimenkul': '🏠', 'Tahvil': '📄', 'Duran Varlık': '💎', 'Diğer': '💼',
}

const currencySymbol: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GR: 'gr' }
const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }

export default function VarliklarClient({ initialAssets }: Props) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [filterCat, setFilterCat] = useState<string>('Tümü')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id) })
  }, [])

  useRealtime<Asset>({
    table: 'assets', userId,
    onInsert: (row) => setAssets(prev => prev.some(a => a.id === row.id) ? prev : [row, ...prev]),
    onUpdate: (row) => setAssets(prev => prev.map(a => a.id === row.id ? row : a)),
    onDelete: (id) => setAssets(prev => prev.filter(a => a.id !== id)),
  })

  const filtered = useMemo(() =>
    filterCat === 'Tümü' ? assets : assets.filter(a => a.category === filterCat),
    [assets, filterCat]
  )

  const summary = useMemo(() => {
    const byCat: Record<string, number> = {}
    let grandTotal = 0
    assets.forEach(a => {
      const val = Number(a.quantity) * Number(a.unit_price)
      byCat[a.category] = (byCat[a.category] ?? 0) + val
      grandTotal += val
    })
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    const max = sorted[0]?.[1] ?? 1
    return { byCat: sorted, max, grandTotal }
  }, [assets])

  const editingAsset = editingId ? assets.find(a => a.id === editingId) : null

  async function saveAsset(form: AssetForm, id?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const qty = parseFloat(String(form.quantity).replace(',', '.'))
    const price = parseFloat(String(form.unit_price).replace(',', '.'))
    if (isNaN(qty) || qty <= 0) { toast.error('Geçersiz miktar'); return }
    if (isNaN(price) || price < 0) { toast.error('Geçersiz birim fiyat'); return }
    const payload = {
      name: form.name, category: form.category,
      quantity: qty, unit_price: price,
      currency: form.currency,
      purchase_date: form.purchase_date || null,
      notes: form.notes || null,
    }
    if (id) {
      const { data, error } = await supabase.from('assets').update(payload).eq('id', id).select().single()
      if (error) { toast.error('Güncellenemedi: ' + error.message); return }
      setAssets(prev => prev.map(a => a.id === id ? data : a))
      toast.success('Varlık güncellendi')
    } else {
      const { data, error } = await supabase.from('assets').insert({ ...payload, user_id: user.id }).select().single()
      if (error) { toast.error('Eklenemedi: ' + error.message); return }
      setAssets(prev => [data, ...prev])
      toast.success('Varlık eklendi')
    }
    setShowModal(false)
    setEditingId(null)
  }

  async function deleteAsset(id: string) {
    if (!confirm('Bu varlığı silmek istiyor musunuz?')) return
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setAssets(prev => prev.filter(a => a.id !== id))
    toast.success('Varlık silindi')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Varlıklar</h1>
        <button
          onClick={() => { setEditingId(null); setShowModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> Varlık Ekle
        </button>
      </div>

      {/* Toplam TL Kartı — her zaman görünür */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Toplam Portföy Değeri</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#F59E0B' }}>
            ₺{summary.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{assets.length} varlık · {summary.byCat.length} kategori</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {summary.byCat.slice(0, 3).map(([cat, val]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>{CAT_EMOJI[cat]}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cat}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: CAT_COLORS[cat] ?? '#6B7280' }}>
                ₺{val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                %{summary.grandTotal > 0 ? Math.round((val / summary.grandTotal) * 100) : 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <TrendingUp size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Henüz varlık eklenmedi</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Altın, döviz, hisse, duran varlık gibi her şeyi ekleyebilirsin.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {summary.byCat.map(([cat, val]) => (
              <div key={cat} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${CAT_COLORS[cat] ?? '#6B7280'}` }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{CAT_EMOJI[cat]}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: CAT_COLORS[cat] ?? '#6B7280', marginTop: 2 }}>
                  ₺{val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Tümü', ...CATEGORIES.filter(c => assets.some(a => a.category === c))].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                backgroundColor: filterCat === cat ? (CAT_COLORS[cat] ?? 'var(--accent)') : 'var(--bg-card)',
                color: filterCat === cat ? 'white' : 'var(--text-secondary)',
              }}>
                {cat === 'Tümü' ? cat : `${CAT_EMOJI[cat]} ${cat}`}
              </button>
            ))}
          </div>

          {/* Asset List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  {['Varlık', 'Kategori', 'Miktar', 'Birim Fiyat', 'Toplam Değer', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const total = Number(a.quantity) * Number(a.unit_price)
                  const sym = currencySymbol[a.currency] ?? '₺'
                  const color = CAT_COLORS[a.category] ?? '#6B7280'
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</div>
                        {a.purchase_date && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {format(new Date(a.purchase_date), 'd MMM yyyy', { locale: tr })}
                        </div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, backgroundColor: `${color}20`, color, fontWeight: 600 }}>
                          {CAT_EMOJI[a.category]} {a.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {a.category === 'Duran Varlık' ? '—' : Number(a.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {a.category === 'Duran Varlık'
                          ? '—'
                          : sym === 'gr'
                            ? `${Number(a.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺/gr`
                            : `${sym}${Number(a.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color }}>
                          {sym === 'gr'
                            ? `₺${total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`
                            : `${sym}${total.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditingId(a.id); setShowModal(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.6 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Category Bar Chart */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Kategoriye Göre Dağılım</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.byCat.map(([cat, val]) => {
                const color = CAT_COLORS[cat] ?? '#6B7280'
                const totalAll = summary.byCat.reduce((s, [, v]) => s + v, 0)
                const pct = Math.round((val / totalAll) * 100)
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{CAT_EMOJI[cat]} {cat}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct}%</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>₺{val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(val / summary.max) * 100}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <AssetModal
          initial={editingAsset ?? undefined}
          onClose={() => { setShowModal(false); setEditingId(null) }}
          onSave={(form) => saveAsset(form, editingId ?? undefined)}
        />
      )}
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssetForm {
  name: string; category: AssetCategory; quantity: string; unit_price: string
  currency: string; purchase_date: string; notes: string
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function AssetModal({ initial, onClose, onSave }: {
  initial?: Asset
  onClose: () => void
  onSave: (form: AssetForm) => Promise<void>
}) {
  const [form, setForm] = useState<AssetForm>({
    name: initial?.name ?? '',
    category: initial?.category ?? 'Altın',
    quantity: initial ? String(initial.quantity) : '',
    unit_price: initial ? String(initial.unit_price) : '',
    currency: initial?.currency ?? 'TRY',
    purchase_date: initial?.purchase_date ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Varlık adı zorunludur'); return }
    if (!form.quantity) { toast.error('Miktar zorunludur'); return }
    if (!form.unit_price) { toast.error('Birim fiyat zorunludur'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{initial ? 'Varlık Düzenle' : 'Varlık Ekle'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={ls}>Varlık Adı *</label>
            <input className="input"
              placeholder={form.category === 'Duran Varlık' ? 'Örn: Evlilik bileziği, Daire, Araba' : 'Örn: Gram Altın, BIST100, Bitcoin'}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label style={ls}>Kategori</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  border: `1px solid ${form.category === cat ? CAT_COLORS[cat] : 'var(--border)'}`,
                  backgroundColor: form.category === cat ? `${CAT_COLORS[cat]}20` : 'transparent',
                  color: form.category === cat ? CAT_COLORS[cat] : 'var(--text-secondary)',
                }}>
                  {CAT_EMOJI[cat]} {cat}
                </button>
              ))}
            </div>
          </div>

          {form.category === 'Duran Varlık' ? (
            <div>
              <label style={ls}>Tahmini Değer (₺) *</label>
              <input type="text" inputMode="decimal" className="input" placeholder="0.00" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value, quantity: '1' }))} />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Miktar otomatik 1 olarak ayarlanır</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={ls}>Miktar *</label>
                <input type="text" inputMode="decimal" className="input" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label style={ls}>Birim Fiyat *</label>
                <input type="text" inputMode="decimal" className="input" placeholder="0.00" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls}>Para Birimi</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="TRY">TRY ₺</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
                {form.category !== 'Duran Varlık' && <option value="GR">Gram (gr)</option>}
              </select>
            </div>
            <div>
              <label style={ls}>Alış Tarihi</label>
              <input type="date" className="input" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
          </div>

          {/* Computed total preview */}
          {form.quantity && form.unit_price && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Toplam Değer: </span>
              <span style={{ fontWeight: 700, color: '#F59E0B' }}>
                {form.currency === 'GR' ? '₺' : (currencySymbol[form.currency] ?? '₺')}
                {(parseFloat(form.quantity.replace(',', '.') || '0') * parseFloat(form.unit_price.replace(',', '.') || '0')).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                {form.currency === 'GR' && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>({form.quantity} gr × {form.unit_price} ₺/gr)</span>}
              </span>
            </div>
          )}

          <div>
            <label style={ls}>Not (opsiyonel)</label>
            <input className="input" placeholder="Açıklama" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>İptal</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', backgroundColor: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Kaydediliyor…' : (initial ? 'Güncelle' : 'Varlık Ekle')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
