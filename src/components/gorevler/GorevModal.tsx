'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X, Trash2 } from 'lucide-react'
import type { Task } from '@/types'

interface Props {
  task: Task | null
  projects: { id: string; name: string; color: string }[]
  defaultColumnId?: string
  defaultProjectId?: string
  defaultDate?: string
  onClose: () => void
  onSaved: (task: Task, isEdit: boolean) => void
  onDelete?: () => void
}

type FormState = {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  due_date: string
  project_id: string
  tags: string
  is_recurring: boolean
  recurrence_type: 'daily' | 'weekly' | 'monthly'
}

const defaultForm: FormState = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  due_date: '',
  project_id: '',
  tags: '',
  is_recurring: false,
  recurrence_type: 'weekly',
}

export default function GorevModal({ task, projects, defaultColumnId, defaultProjectId, defaultDate, onClose, onSaved, onDelete }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        status: task.status,
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        project_id: task.project_id ?? '',
        tags: task.tags.join(', '),
        is_recurring: task.is_recurring,
        recurrence_type: task.recurrence_type ?? 'weekly',
      })
    } else {
      setForm({ ...defaultForm, due_date: defaultDate ?? '', project_id: defaultProjectId ?? '' })
    }
  }, [task, defaultDate, defaultProjectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Başlık gerekli'); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      project_id: form.project_id || null,
      kanban_column_id: defaultColumnId ?? null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      is_recurring: form.is_recurring,
      recurrence_type: form.is_recurring ? form.recurrence_type : null,
      updated_at: new Date().toISOString(),
    }

    if (task) {
      const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', task.id)
        .select()
        .single()

      if (error) { toast.error('Güncellenemedi'); setLoading(false); return }
      toast.success('Görev güncellendi')
      onSaved(data, true)
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select()
        .single()

      if (error) { toast.error('Eklenemedi'); setLoading(false); return }
      toast.success('Görev eklendi')
      onSaved(data, false)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-fade-in"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {task ? 'Görevi Düzenle' : 'Yeni Görev'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Başlık *</label>
            <input
              className="input"
              placeholder="Görev başlığı"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Açıklama</label>
            <textarea
              className="input"
              placeholder="Açıklama (opsiyonel)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Priority & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Öncelik</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as never }))}>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Durum</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as never }))}>
                <option value="todo">Yapılacak</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="done">Tamamlandı</option>
                <option value="cancelled">İptal</option>
              </select>
            </div>
          </div>

          {/* Due Date & Project */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Son Tarih</label>
              <input
                type="date"
                className="input"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Proje</label>
              <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">Proje Yok</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Etiketler</label>
            <input
              className="input"
              placeholder="etiket1, etiket2, etiket3"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Virgülle ayırın</p>
          </div>

          {/* Recurring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="recurring"
              checked={form.is_recurring}
              onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <label htmlFor="recurring" style={{ fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Tekrarlayan görev
            </label>
            {form.is_recurring && (
              <select
                className="input"
                value={form.recurrence_type}
                onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value as never }))}
                style={{ marginLeft: 'auto', width: 'auto' }}
              >
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
              </select>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: 'var(--error)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Trash2 size={15} /> Sil
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '10px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Kaydediliyor...' : (task ? 'Güncelle' : 'Ekle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  fontWeight: 500,
}
