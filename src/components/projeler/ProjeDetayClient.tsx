'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Settings, Flag, ChevronLeft, GripVertical } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import Link from 'next/link'
import type { Task, Project, Milestone, KanbanColumn } from '@/types'
import GorevModal from '@/components/gorevler/GorevModal'

interface Props {
  project: Project
  initialColumns: KanbanColumn[]
  initialTasks: Task[]
  initialMilestones: Milestone[]
}

const priorityColors: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
  urgent: '#EF4444',
}

const priorityLabels: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil',
}

// ---------- Sortable Task Card ----------
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <div
        onClick={onClick}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          position: 'relative',
        }}
      >
        {/* Drag Handle */}
        <div
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            cursor: 'grab',
            color: 'var(--text-secondary)',
            opacity: 0.4,
            padding: 2,
          }}
        >
          <GripVertical size={14} />
        </div>

        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, paddingRight: 20, lineHeight: 1.4, textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
          {task.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 3,
              backgroundColor: `${priorityColors[task.priority]}20`,
              color: priorityColors[task.priority],
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {priorityLabels[task.priority]}
          </span>
          {task.due_date && (
            <span style={{ fontSize: 11, color: isOverdue ? 'var(--error)' : 'var(--text-secondary)' }}>
              {isOverdue && '⚠ '}
              {format(new Date(task.due_date), 'd MMM', { locale: tr })}
            </span>
          )}
        </div>
        {task.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {task.tags.map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 3,
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Kanban Column ----------
function KanbanCol({
  column,
  tasks,
  onAddTask,
  onTaskClick,
}: {
  column: KanbanColumn
  tasks: Task[]
  onAddTask: (columnId: string) => void
  onTaskClick: (task: Task) => void
}) {
  return (
    <div
      style={{
        minWidth: 280,
        maxWidth: 280,
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Column Header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{column.title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', borderRadius: 10, padding: '1px 7px', border: '1px solid var(--border)' }}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}
          title="Görev ekle"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tasks */}
      <div
        style={{
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 120,
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 280px)',
        }}
        className="scroll-ios"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
            Görev yok
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Main Component ----------
export default function ProjeDetayClient({ project, initialColumns, initialTasks, initialMilestones }: Props) {
  const [columns, setColumns] = useState<KanbanColumn[]>(
    initialColumns.length > 0
      ? initialColumns
      : [
          { id: 'default-todo', project_id: project.id, title: 'Yapılacak', order: 0 },
          { id: 'default-progress', project_id: project.id, title: 'Devam Ediyor', order: 1 },
          { id: 'default-done', project_id: project.id, title: 'Tamamlandı', order: 2 },
        ]
  )
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [defaultColumnId, setDefaultColumnId] = useState<string | null>(null)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [showMilestones, setShowMilestones] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ title: '', due_date: '' })
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  // Ensure default columns exist in DB
  async function ensureColumns() {
    if (initialColumns.length === 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const defaultCols = [
        { user_id: user.id, project_id: project.id, title: 'Yapılacak', order: 0 },
        { user_id: user.id, project_id: project.id, title: 'Devam Ediyor', order: 1 },
        { user_id: user.id, project_id: project.id, title: 'Tamamlandı', order: 2 },
      ]
      const { data } = await supabase.from('kanban_columns').insert(defaultCols).select()
      if (data) setColumns(data)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    // Over another task → same column reorder (handled in dragEnd)
    // Over a column container
    const overColumn = columns.find(c => c.id === over.id)
    if (overColumn && activeTask.kanban_column_id !== overColumn.id) {
      setTasks(prev => prev.map(t =>
        t.id === activeTask.id ? { ...t, kanban_column_id: overColumn.id } : t
      ))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const movedTask = tasks.find(t => t.id === active.id)
    if (!movedTask) return

    // Find target column
    const overTask = tasks.find(t => t.id === over.id)
    const targetColumnId = overTask
      ? (overTask.kanban_column_id ?? columns[0]?.id)
      : columns.find(c => c.id === over.id)?.id ?? movedTask.kanban_column_id

    if (!targetColumnId) return

    // Update in DB
    const { error } = await supabase
      .from('tasks')
      .update({ kanban_column_id: targetColumnId, updated_at: new Date().toISOString() })
      .eq('id', movedTask.id)

    if (error) { toast.error('Taşıma başarısız'); return }

    setTasks(prev => prev.map(t =>
      t.id === movedTask.id ? { ...t, kanban_column_id: targetColumnId } : t
    ))
  }

  async function addColumn() {
    if (!newColumnTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const order = columns.length
    const { data, error } = await supabase
      .from('kanban_columns')
      .insert({ user_id: user.id, project_id: project.id, title: newColumnTitle.trim(), order })
      .select().single()

    if (error) { toast.error('Eklenemedi'); return }
    setColumns(prev => [...prev, data])
    setNewColumnTitle('')
    setAddingColumn(false)
    toast.success('Sütun eklendi')
  }

  async function addMilestone() {
    if (!newMilestone.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('milestones')
      .insert({ user_id: user.id, project_id: project.id, title: newMilestone.title.trim(), due_date: newMilestone.due_date || null })
      .select().single()

    if (error) { toast.error('Eklenemedi'); return }
    setMilestones(prev => [...prev, data])
    setNewMilestone({ title: '', due_date: '' })
    toast.success('Milestone eklendi')
  }

  async function toggleMilestone(id: string, current: boolean) {
    const { error } = await supabase.from('milestones').update({ is_completed: !current }).eq('id', id)
    if (error) return
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, is_completed: !current } : m))
  }

  function handleAddTask(columnId: string) {
    ensureColumns()
    setDefaultColumnId(columnId)
    setEditingTask(null)
    setShowTaskModal(true)
  }

  function handleTaskSaved(task: Task, isEdit: boolean) {
    if (isEdit) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
    } else {
      setTasks(prev => [...prev, task])
    }
    setShowTaskModal(false)
    setEditingTask(null)
  }

  async function deleteTask(id: string) {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('Görev silindi')
    setShowTaskModal(false)
    setEditingTask(null)
  }

  // Progress
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/projeler"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 12 }}
        >
          <ChevronLeft size={15} /> Projeler
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{project.name}</h1>
            </div>
            {project.description && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginLeft: 24 }}>{project.description}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                backgroundColor: showMilestones ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
                border: `1px solid ${showMilestones ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                color: showMilestones ? 'var(--accent)' : 'var(--text-secondary)',
                borderRadius: 8, fontSize: 13, cursor: 'pointer',
              }}
            >
              <Flag size={15} /> Milestone ({milestones.length})
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16, marginLeft: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{doneTasks}/{totalTasks} görev tamamlandı</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{progress}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--border)', maxWidth: 400 }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: project.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Milestones Panel */}
      {showMilestones && (
        <div className="card animate-fade-in" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            🏁 Milestone'lar
          </h3>

          {milestones.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {milestones.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={m.is_completed}
                    onChange={() => toggleMilestone(m.id, m.is_completed)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', textDecoration: m.is_completed ? 'line-through' : 'none', opacity: m.is_completed ? 0.6 : 1 }}>
                    {m.title}
                  </span>
                  {m.due_date && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {format(new Date(m.due_date), 'd MMM', { locale: tr })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Milestone */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Yeni milestone..."
              value={newMilestone.title}
              onChange={e => setNewMilestone(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addMilestone() }}
              style={{ flex: 1 }}
            />
            <input
              type="date"
              className="input"
              value={newMilestone.due_date}
              onChange={e => setNewMilestone(f => ({ ...f, due_date: e.target.value }))}
              style={{ width: 140 }}
            />
            <button
              onClick={addMilestone}
              style={{ padding: '8px 14px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            >
              Ekle
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 20,
            alignItems: 'flex-start',
          }}
          className="scroll-ios"
        >
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.kanban_column_id === col.id || (!t.kanban_column_id && col.order === 0))
            return (
              <KanbanCol
                key={col.id}
                column={col}
                tasks={colTasks}
                onAddTask={handleAddTask}
                onTaskClick={t => { setEditingTask(t); setShowTaskModal(true) }}
              />
            )
          })}

          {/* Add Column */}
          <div style={{ minWidth: 240, flexShrink: 0 }}>
            {addingColumn ? (
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                <input
                  className="input"
                  placeholder="Sütun adı..."
                  value={newColumnTitle}
                  onChange={e => setNewColumnTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingColumn(false) }}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addColumn} style={{ flex: 1, padding: '7px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Ekle</button>
                  <button onClick={() => setAddingColumn(false)} style={{ flex: 1, padding: '7px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>İptal</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: 'transparent',
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                <Plus size={15} /> Sütun Ekle
              </button>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--accent)',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              width: 260,
            }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{activeTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      {showTaskModal && (
        <GorevModal
          task={editingTask}
          projects={[{ id: project.id, name: project.name, color: project.color }]}
          defaultColumnId={defaultColumnId ?? undefined}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); setDefaultColumnId(null) }}
          onSaved={handleTaskSaved}
          onDelete={editingTask ? () => deleteTask(editingTask.id) : undefined}
        />
      )}
    </div>
  )
}
