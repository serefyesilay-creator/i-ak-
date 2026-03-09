'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

export default function YeniProjePage() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    start_date: '',
    end_date: '',
    status: 'active',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Proje adı gerekli'); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
      .select()
      .single()

    if (error) { toast.error('Proje oluşturulamadı'); setLoading(false); return }
    toast.success('Proje oluşturuldu')
    router.push(`/projeler/${data.id}`)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link
        href="/projeler"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 20 }}
      >
        <ChevronLeft size={15} /> Projeler
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>Yeni Proje</h1>

      <div className="card" style={{ padding: 28 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={ls}>Proje Adı *</label>
            <input
              className="input"
              placeholder="Proje adını girin"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label style={ls}>Açıklama</label>
            <textarea
              className="input"
              placeholder="Proje hakkında kısa açıklama..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label style={ls}>Renk</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: form.color === color ? '3px solid white' : '3px solid transparent',
                    outline: form.color === color ? `2px solid ${color}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls}>Başlangıç Tarihi</label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={ls}>Bitiş Tarihi</label>
              <input
                type="date"
                className="input"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={ls}>Durum</label>
            <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Aktif</option>
              <option value="on_hold">Beklemede</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </div>

          {/* Preview */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: form.color, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: form.name ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {form.name || 'Proje adı...'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Link
              href="/projeler"
              style={{ flex: 1, padding: '11px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 2, padding: '11px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Oluşturuluyor...' : 'Proje Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }
