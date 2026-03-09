'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Filter, Search, X, CheckCircle2, Circle, Clock, Ban, Trash2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Task } from '@/types'
import GorevModal from './GorevModal'

interface Props {
  initialTasks: Task[]
  projects: { id: string; name: string; color: string }[]
}

const priorityConfig = {
  low: { label: 'Düşük', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  medium: { label: 'Orta', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  high: { label: 'Yüksek', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  urgent: { label: 'Acil', color: '#EF4444', bg: 'rgba(239,68,68,0.2)', animate: true },
}

const statusIcon = {
  todo: <Circle size={18} color="#888" />,
  in_progress: <Clock size={18} color="#F59E0B" />,
  done: <CheckCircle2 size={18} color="#22C55E" />,
  cancelled: <Ban size={18} color="#888" />,
}

const statusLabel: Record<string, string> = {
  todo: 'Yapılacak',
  in_progress: 'Devam Ediyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
}

export default function GorevlerClient({ initialTasks, projects }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [recentlyDone, setRecentlyDone] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<{ type: string; message: string } | null>(null)
  const [bulkMoveStatus, setBulkMoveStatus] = useState<string>('')
  const supabase = createClient()

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = search === '' ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      const matchPriority = filterPriority === 'all' || t.priority === filterPriority
      return matchSearch && matchStatus && matchPriority
    })
  }, [tasks, search, filterStatus, filterPriority])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setEditingTask(null)
        setShowModal(true)
      }
      if (e.key === 'Escape') {
        if (showModal) { setShowModal(false); setEditingTask(null) }
        else if (selectionMode) { setSelectionMode(false); setSelectedIds(new Set()) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal, selectionMode])

  async function toggleStatus(task: Task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    if (error) { toast.error('Hata oluştu'); return }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))

    if (nextStatus === 'done') {
      setRecentlyDone(prev => new Set(prev).add(task.id))
      setTimeout(() => setRecentlyDone(prev => { const n = new Set(prev); n.delete(task.id); return n }), 600)
    }
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('Görev silindi')
  }

  const handleSaved = useCallback((task: Task, isEdit: boolean) => {
    if (isEdit) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
    } else {
      setTasks(prev => [task, ...prev])
    }
    setShowModal(false)
    setEditingTask(null)
  }, [])

  // Bulk Actions
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)))
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('tasks').delete().in('id', ids)
    if (error) { toast.error('Silinemedi'); return }
    setTasks(prev => prev.filter(t => !selectedIds.has(t.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    setConfirmAction(null)
    toast.success(`${ids.length} görev silindi`)
  }

  async function bulkMove(status: string) {
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).in('id', ids)
    if (error) { toast.error('Taşınamadı'); return }
    setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status: status as Task['status'] } : t))
    setSelectedIds(new Set())
    setSelectionMode(false)
    setConfirmAction(null)
    setBulkMoveStatus('')
    toast.success(`${ids.length} görev taşındı`)
  }

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Görevler</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {stats.done}/{stats.total} tamamlandı
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()) }}
            style={{
              padding: '9px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
              backgroundColor: selectionMode ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
              color: selectionMode ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${selectionMode ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            }}
          >
            {selectionMode ? 'İptal' : 'Seç'}
          </button>
          <button
            onClick={() => { setEditingTask(null); setShowModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              backgroundColor: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>Yeni Görev</span>
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>(N)</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="card animate-fade-in" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{selectedIds.size} seçili</span>
          <button onClick={selectAll} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            {selectedIds.size === filtered.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
          </button>
          <div style={{ flex: 1 }} />
          <select
            className="input"
            value={bulkMoveStatus}
            onChange={e => setBulkMoveStatus(e.target.value)}
            style={{ width: 'auto', fontSize: 13 }}
          >
            <option value="">Taşı...</option>
            <option value="todo">Yapılacak</option>
            <option value="in_progress">Devam Ediyor</option>
            <option value="done">Tamamlandı</option>
          </select>
          {bulkMoveStatus && (
            <button
              onClick={() => bulkMove(bulkMoveStatus)}
              style={{ padding: '6px 12px', fontSize: 13, backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowRight size={14} /> Taşı
            </button>
          )}
          <button
            onClick={() => setConfirmAction({ type: 'bulkDelete', message: `${selectedIds.size} görevi silmek istediğinize emin misiniz?` })}
            style={{ padding: '6px 12px', fontSize: 13, backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Trash2 size={14} /> Sil
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Yapılacak', value: stats.todo, color: '#6366F1' },
          { label: 'Devam Eden', value: stats.inProgress, color: '#F59E0B' },
          { label: 'Tamamlanan', value: stats.done, color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input type="text" className="input" placeholder="Görev ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            backgroundColor: showFilters ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
            border: `1px solid ${showFilters ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            color: showFilters ? 'var(--accent)' : 'var(--text-secondary)',
            borderRadius: 6, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <Filter size={15} /> Filtrele
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card animate-fade-in" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Durum</label>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Tümü</option>
              <option value="todo">Yapılacak</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="done">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Öncelik</label>
            <select className="input" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="all">Tümü</option>
              <option value="urgent">Acil</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
          </div>
          {(filterStatus !== 'all' || filterPriority !== 'all') && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterPriority('all') }}
              style={{ alignSelf: 'flex-end', padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} /> Sıfırla
            </button>
          )}
        </div>
      )}

      {/* Task List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 15 }}>Görev bulunamadı.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Yeni bir görev ekleyin veya filtreleri değiştirin.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(task => {
            const p = priorityConfig[task.priority]
            const project = projects.find(pr => pr.id === task.project_id)
            const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()
            const isSelected = selectedIds.has(task.id)
            const justDone = recentlyDone.has(task.id)

            return (
              <div
                key={task.id}
                className={`card ${isSelected ? 'task-selected' : ''}`}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  opacity: task.status === 'cancelled' ? 0.5 : 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  if (selectionMode) { toggleSelect(task.id) }
                  else { setEditingTask(task); setShowModal(true) }
                }}
              >
                {/* Selection Checkbox or Status Toggle */}
                {selectionMode ? (
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(task.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: 2 }}
                  />
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); toggleStatus(task) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0 }}
                  >
                    {statusIcon[task.status]}
                  </button>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      className={justDone ? 'task-done' : ''}
                      style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                        textDecoration: task.status === 'done' && !justDone ? 'line-through' : 'none',
                        opacity: task.status === 'done' ? 0.6 : 1,
                        lineHeight: 1.4,
                        display: 'inline-block',
                      }}
                    >
                      {task.title}
                    </span>
                    {task.is_recurring && (
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>🔄</span>
                    )}
                  </div>
                  {task.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                      {task.description.slice(0, 80)}{task.description.length > 80 ? '...' : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, backgroundColor: p.bg, color: p.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {p.label}
                    </span>
                    {project && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, display: 'inline-block' }} />
                        {project.name}
                      </span>
                    )}
                    {task.due_date && (
                      <span style={{ fontSize: 12, color: isOverdue ? 'var(--error)' : 'var(--text-secondary)', fontWeight: isOverdue ? 600 : 400 }}>
                        {isOverdue ? '⚠ ' : ''}{format(new Date(task.due_date), 'd MMM', { locale: tr })}
                      </span>
                    )}
                    {task.tags.length > 0 && task.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <GorevModal
          task={editingTask}
          projects={projects}
          onClose={() => { setShowModal(false); setEditingTask(null) }}
          onSaved={handleSaved}
          onDelete={editingTask ? () => {
            setConfirmAction({ type: 'singleDelete', message: `"${editingTask.title}" görevini silmek istediğinize emin misiniz?` })
          } : undefined}
        />
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="confirm-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmAction(null) }}>
          <div className="confirm-box animate-fade-in">
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Emin misiniz?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'bulkDelete') bulkDelete()
                  else if (confirmAction.type === 'singleDelete' && editingTask) {
                    deleteTask(editingTask.id)
                    setShowModal(false)
                    setEditingTask(null)
                    setConfirmAction(null)
                  }
                }}
                style={{ flex: 1, padding: '10px', backgroundColor: 'var(--error)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
