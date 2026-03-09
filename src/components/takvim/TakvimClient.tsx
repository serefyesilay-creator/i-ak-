'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, GripVertical } from 'lucide-react'
import type { Task } from '@/types'
import GorevModal from '@/components/gorevler/GorevModal'

interface TaskItem {
  id: string
  title: string
  due_date: string
  priority: string
  status: string
  project_id: string | null
}

interface MilestoneItem {
  id: string
  title: string
  due_date: string
  is_completed: boolean
  project_id: string
}

interface Props {
  tasks: TaskItem[]
  milestones: MilestoneItem[]
  projects: { id: string; name: string; color: string }[]
}

const priorityColors: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
  urgent: '#EF4444',
}

export default function TakvimClient({ tasks: initialTasks, milestones, projects }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [showGorevModal, setShowGorevModal] = useState(false)
  const [addDate, setAddDate] = useState<string>('')
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const supabase = createClient()

  // Calculate days based on view mode
  let days: Date[]
  if (viewMode === 'month') {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calStart = startOfWeek(monthStart, { locale: tr, weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { locale: tr, weekStartsOn: 1 })
    days = eachDayOfInterval({ start: calStart, end: calEnd })
  } else {
    const weekStart = startOfWeek(currentDate, { locale: tr, weekStartsOn: 1 })
    const weekEnd = endOfWeek(currentDate, { locale: tr, weekStartsOn: 1 })
    days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  }

  function navigate(dir: 'prev' | 'next') {
    if (viewMode === 'month') {
      setCurrentDate(dir === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    } else {
      setCurrentDate(dir === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    }
  }

  function getItemsForDay(day: Date) {
    const dayTasks = tasks.filter(t => isSameDay(new Date(t.due_date), day))
    const dayMilestones = milestones.filter(m => isSameDay(new Date(m.due_date), day))
    return { tasks: dayTasks, milestones: dayMilestones }
  }

  function handleAddTask(day: Date) {
    setAddDate(day.toISOString().split('T')[0])
    setShowGorevModal(true)
  }

  function handleTaskSaved(task: Task) {
    setTasks(prev => [...prev, {
      id: task.id,
      title: task.title,
      due_date: task.due_date!,
      priority: task.priority,
      status: task.status,
      project_id: task.project_id ?? null,
    }])
    setShowGorevModal(false)
  }

  // ── Drag & Drop Handlers ──
  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDragTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  function handleDragEnd() {
    setDragTaskId(null)
    setDragOverDay(null)
  }

  function handleDayDragOver(e: React.DragEvent, dayStr: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDay(dayStr)
  }

  function handleDayDragLeave() {
    setDragOverDay(null)
  }

  async function handleDayDrop(e: React.DragEvent, day: Date) {
    e.preventDefault()
    setDragOverDay(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const newDate = format(day, 'yyyy-MM-dd')
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Don't update if same day
    if (task.due_date === newDate) return

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDate } : t))

    // Update in Supabase
    const { error } = await supabase.from('tasks').update({ due_date: newDate }).eq('id', taskId)
    if (error) {
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: task.due_date } : t))
      toast.error('Tarih güncellenemedi')
    } else {
      toast.success(`Görev ${format(day, 'd MMM', { locale: tr })} tarihine taşındı`)
    }

    setDragTaskId(null)
  }

  const selectedItems = selectedDay ? getItemsForDay(selectedDay) : null

  const headerText = viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: tr })
    : `${format(days[0], 'd MMM', { locale: tr })} — ${format(days[days.length - 1], 'd MMM yyyy', { locale: tr })}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Takvim</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['month', 'week'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 14px', fontSize: 13, cursor: 'pointer', border: 'none',
                  backgroundColor: viewMode === mode ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
                  color: viewMode === mode ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: viewMode === mode ? 600 : 400,
                }}
              >
                {mode === 'month' ? 'Ay' : 'Hafta'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            style={{ fontSize: 13, color: 'var(--accent)', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
          >
            Bugün
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => navigate('prev')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 6 }}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {headerText}
          </h2>
          <button onClick={() => navigate('next')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 6 }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: '6px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const { tasks: dt, milestones: dm } = getItemsForDay(day)
            const hasItems = dt.length > 0 || dm.length > 0
            const isCurrentMonth = viewMode === 'week' || isSameMonth(day, currentDate)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isTodayDay = isToday(day)
            const isDragOver = dragOverDay === dayStr && dragTaskId !== null

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                onDragOver={(e) => handleDayDragOver(e, dayStr)}
                onDragLeave={handleDayDragLeave}
                onDrop={(e) => handleDayDrop(e, day)}
                style={{
                  padding: viewMode === 'week' ? '12px 4px' : '8px 4px',
                  borderRadius: 8,
                  border: isDragOver ? '2px dashed var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  backgroundColor: isDragOver
                    ? 'rgba(99,102,241,0.15)'
                    : isSelected
                      ? 'rgba(99,102,241,0.2)'
                      : isTodayDay
                        ? 'rgba(99,102,241,0.1)'
                        : 'transparent',
                  minHeight: viewMode === 'week' ? 80 : 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isTodayDay ? 700 : 400,
                    color: !isCurrentMonth
                      ? '#444'
                      : isSelected || isTodayDay
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: isTodayDay ? 'rgba(99,102,241,0.15)' : 'transparent',
                  }}
                >
                  {format(day, 'd')}
                </span>

                {/* Week view: show draggable task titles */}
                {viewMode === 'week' && isCurrentMonth && dt.slice(0, 3).map(t => (
                  <span
                    key={t.id}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, t.id) }}
                    onDragEnd={handleDragEnd}
                    style={{
                      fontSize: 10, backgroundColor: `${priorityColors[t.priority] ?? 'var(--accent)'}22`,
                      color: priorityColors[t.priority] ?? 'var(--accent)',
                      padding: '2px 5px', borderRadius: 3, width: '90%', textAlign: 'left',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'grab', display: 'flex', alignItems: 'center', gap: 2,
                    }}
                  >
                    <GripVertical size={8} style={{ opacity: 0.5, flexShrink: 0 }} />
                    {t.title}
                  </span>
                ))}

                {/* Dots for month view */}
                {viewMode === 'month' && hasItems && isCurrentMonth && (
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dt.slice(0, 3).map(t => (
                      <span key={t.id} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: priorityColors[t.priority] ?? 'var(--accent)', display: 'block' }} />
                    ))}
                    {dm.slice(0, 2).map(m => (
                      <span key={m.id} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'block' }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {dragTaskId && (
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--accent)', opacity: 0.8 }}>
            📌 Görevi istediğiniz güne sürükleyip bırakın
          </p>
        )}
      </div>

      {/* Selected Day Detail */}
      {selectedDay && selectedItems && (
        <div className="card animate-fade-in" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color="var(--accent)" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {format(selectedDay, 'd MMMM yyyy, EEEE', { locale: tr })}
              </h3>
            </div>
            <button
              onClick={() => handleAddTask(selectedDay)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', backgroundColor: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >
              <Plus size={14} /> Görev Ekle
            </button>
          </div>

          {selectedItems.tasks.length === 0 && selectedItems.milestones.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Bu gün için etkinlik yok.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedItems.tasks.map(t => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    backgroundColor: 'var(--bg-surface)', borderRadius: 8,
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${priorityColors[t.priority] ?? 'var(--accent)'}`,
                    cursor: 'grab',
                  }}
                >
                  <GripVertical size={14} color="var(--text-secondary)" style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.6 : 1 }}>
                    {t.title}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t.status === 'done' ? '✓' : ''}</span>
                </div>
              ))}
              {selectedItems.milestones.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    backgroundColor: 'var(--bg-surface)', borderRadius: 8,
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--accent)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>🏁 MİLESTONE</span>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', textDecoration: m.is_completed ? 'line-through' : 'none', opacity: m.is_completed ? 0.6 : 1 }}>
                    {m.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GorevModal for adding from calendar */}
      {showGorevModal && (
        <GorevModal
          task={null}
          projects={projects}
          defaultDate={addDate}
          onClose={() => setShowGorevModal(false)}
          onSaved={(task) => handleTaskSaved(task)}
        />
      )}
    </div>
  )
}
