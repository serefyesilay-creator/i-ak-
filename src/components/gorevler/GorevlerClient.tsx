'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import { Plus, Filter, Search, X, CheckCircle2, Check, Repeat, Trash2, ArrowRight } from 'lucide-react'
import { format, startOfDay, addDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Task } from '@/types'
import GorevModal from './GorevModal'

interface Props {
  initialTasks: Task[]
  projects: { id: string; name: string; color: string }[]
}

const priorityConfig = {
  low: { label: 'Düşük', color: '#4ADE80' },
  medium: { label: 'Orta', color: '#FBBF24' },
  high: { label: 'Yüksek', color: '#F87171' },
  urgent: { label: 'Acil', color: '#F87171' },
}

// Liste, teslim tarihine göre bu sırayla gruplanır
const BUCKETS = [
  { key: 'overdue', label: 'Gecikmiş', color: '#F87171' },
  { key: 'today', label: 'Bugün', color: 'var(--mark)' },
  { key: 'tomorrow', label: 'Yarın', color: 'var(--accent-soft)' },
  { key: 'week', label: 'Bu hafta', color: 'var(--accent-soft)' },
  { key: 'later', label: 'Daha sonra', color: 'var(--border-strong)' },
  { key: 'nodate', label: 'Tarihsiz', color: 'var(--border-strong)' },
  { key: 'done', label: 'Tamamlanan', color: '#4ADE80' },
  { key: 'cancelled', label: 'İptal', color: 'var(--border-strong)' },
] as const

type BucketKey = (typeof BUCKETS)[number]['key']

function bucketOf(task: Task, todayStart: Date): BucketKey {
  if (task.status === 'cancelled') return 'cancelled'
  if (task.status === 'done') return 'done'
  if (!task.due_date) return 'nodate'
  const d = new Date(task.due_date)
  if (d < todayStart) return 'overdue'
  if (d < addDays(todayStart, 1)) return 'today'
  if (d < addDays(todayStart, 2)) return 'tomorrow'
  if (d < addDays(todayStart, 7)) return 'week'
  return 'later'
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
  const [userId, setUserId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useRealtime<Task>({
    table: 'tasks',
    userId,
    onInsert: (row) => setTasks(prev => prev.some(t => t.id === row.id) ? prev : [row, ...prev]),
    onUpdate: (row) => setTasks(prev => prev.map(t => t.id === row.id ? row : t)),
    onDelete: (id) => setTasks(prev => prev.filter(t => t.id !== id)),
  })

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

  const grouped = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const byDue = (x: Task, y: Task) => (x.due_date ?? '9999').localeCompare(y.due_date ?? '9999')
    return BUCKETS
      .map(bucket => ({ ...bucket, tasks: filtered.filter(t => bucketOf(t, todayStart) === bucket.key).sort(byDue) }))
      .filter(g => g.tasks.length > 0)
  }, [filtered])

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
      <div className="page-head">
        <div>
          <h1 className="page-title">Görevler</h1>
          <p className="page-sub">
            {stats.total === 0 ? 'Henüz görev yok' : `${stats.total} görevden ${stats.done} tanesi tamamlandı`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            aria-pressed={selectionMode}
            onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()) }}
          >
            {selectionMode ? 'İptal' : 'Seç'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowModal(true) }}>
            <Plus size={16} /> Yeni görev <span className="kbd">N</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="card animate-fade-in" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-soft)' }}>{selectedIds.size} seçili</span>
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

      {/* Durum sekmeleri + arama */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg" role="group" aria-label="Duruma göre filtrele">
          {[
            { value: 'all', label: 'Tümü', count: stats.total },
            { value: 'todo', label: 'Yapılacak', count: stats.todo },
            { value: 'in_progress', label: 'Devam eden', count: stats.inProgress },
            { value: 'done', label: 'Tamamlanan', count: stats.done },
          ].map(o => (
            <button key={o.value} aria-pressed={filterStatus === o.value} onClick={() => setFilterStatus(o.value)}>
              {o.label} <span className="seg-count">{o.count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input type="text" className="input" placeholder="Görev ara…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, height: 40 }} />
        </div>
        <button className="btn" aria-pressed={showFilters || filterPriority !== 'all'} onClick={() => setShowFilters(!showFilters)}>
          <Filter size={15} /> Öncelik
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
        <div className="panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, color: 'var(--text-primary)' }}>Görev bulunamadı.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Yeni bir görev ekleyin veya filtreleri değiştirin.</p>
        </div>
      ) : (
        <div className="panel">
          {grouped.map((group, gi) => (
            <section key={group.key} aria-label={group.label}>
              <div className="group-title" style={{ paddingTop: gi === 0 ? 16 : 22 }}>
                <span className="tick" style={{ background: group.color }} />
                <b style={{ color: group.key === 'overdue' ? group.color : undefined }}>{group.label}</b>
                <span className="num">{group.tasks.length}</span>
              </div>
              {group.tasks.map(task => {
                const p = priorityConfig[task.priority]
                const project = projects.find(pr => pr.id === task.project_id)
                const isOverdue = group.key === 'overdue'
                const isSelected = selectedIds.has(task.id)
                const justDone = recentlyDone.has(task.id)
                const done = task.status === 'done'

                return (
                  <div
                    key={task.id}
                    className={`row ${isSelected ? 'task-selected' : ''}`}
                    style={{
                      opacity: task.status === 'cancelled' ? 0.5 : 1,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--accent)' : undefined,
                    }}
                    onClick={() => {
                      if (selectionMode) { toggleSelect(task.id) }
                      else { setEditingTask(task); setShowModal(true) }
                    }}
                  >
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
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
                        title={statusLabel[task.status]}
                        className={`check ${task.status === 'in_progress' ? 'is-progress' : ''}`}
                        onClick={e => { e.stopPropagation(); toggleStatus(task) }}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        className={`row-title ${justDone ? 'task-done' : ''}`}
                        style={{
                          textDecoration: done && !justDone ? 'line-through' : 'none',
                          opacity: done ? 0.5 : 1,
                          display: 'inline-block',
                        }}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
                          {task.description.slice(0, 90)}{task.description.length > 90 ? '…' : ''}
                        </p>
                      )}
                      <div className="row-meta">
                        {project && (
                          <span><span className="dot" style={{ backgroundColor: project.color }} />{project.name}</span>
                        )}
                        {task.status === 'in_progress' && <span style={{ color: '#FBBF24' }}>Devam ediyor</span>}
                        {task.due_date && (
                          <span style={{ color: isOverdue ? '#F87171' : undefined, fontWeight: isOverdue ? 600 : 400 }}>
                            {format(new Date(task.due_date), 'd MMM EEE', { locale: tr })}
                          </span>
                        )}
                        {task.is_recurring && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Repeat size={12} /> Tekrarlı</span>
                        )}
                        {task.tags.map(tag => <span key={tag}>#{tag}</span>)}
                      </div>
                    </div>

                    {!done && (
                      <span className="prio" style={{ color: p.color, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ width: 3, height: 12, borderRadius: 2, background: p.color }} />
                        {p.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
          <div style={{ height: 6 }} />
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
