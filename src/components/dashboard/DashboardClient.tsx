'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import type { Task, Project, Note, Invoice } from '@/types'
import { useRealtime } from '@/hooks/useRealtime'

interface Props {
  userId: string
  allTasks: Task[]
  activeProjects: Project[]
  pendingInvoices: Invoice[]
  recentNotes: Note[]
}

const priorityConfig = {
  low: { label: 'Düşük', color: '#22C55E' },
  medium: { label: 'Orta', color: '#F59E0B' },
  high: { label: 'Yüksek', color: '#EF4444' },
  urgent: { label: 'Acil', color: '#EF4444' },
}

const statusConfig = {
  todo: { label: 'Yapılacak', bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
  in_progress: { label: 'Devam Ediyor', bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  done: { label: 'Tamamlandı', bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  cancelled: { label: 'İptal', bg: 'rgba(136,136,136,0.12)', color: '#888' },
}

function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
        {count !== undefined && (
          <span
            style={{
              backgroundColor: 'rgba(99,102,241,0.15)',
              color: 'var(--accent)',
              borderRadius: 20,
              padding: '1px 8px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          Tümü <ChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

function TaskItem({ task }: { task: Task }) {
  const p = priorityConfig[task.priority]
  const s = statusConfig[task.status]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 3,
          height: 36,
          borderRadius: 2,
          backgroundColor: p.color,
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: s.bg,
              color: s.color,
            }}
          >
            {s.label}
          </span>
          {task.due_date && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {format(new Date(task.due_date), 'd MMM', { locale: tr })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '24px 0',
        color: 'var(--text-secondary)',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  )
}

export default function DashboardClient({ userId, allTasks: initialTasks, activeProjects: initialProjects, pendingInvoices: initialInvoices, recentNotes: initialNotes }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [notes, setNotes] = useState<Note[]>(initialNotes)

  // Realtime subscriptions
  useRealtime<Task>({
    table: 'tasks',
    userId,
    onInsert: (row) => {
      if (row.status !== 'cancelled') {
        setTasks(prev => prev.some(t => t.id === row.id) ? prev : [...prev, row])
      }
    },
    onUpdate: (row) => {
      if (row.status === 'cancelled') {
        setTasks(prev => prev.filter(t => t.id !== row.id))
      } else {
        setTasks(prev => prev.map(t => t.id === row.id ? row : t))
      }
    },
    onDelete: (id) => setTasks(prev => prev.filter(t => t.id !== id)),
  })

  useRealtime<Project>({
    table: 'projects',
    userId,
    onInsert: (row) => {
      if (row.status === 'active') {
        setProjects(prev => prev.some(p => p.id === row.id) ? prev : [row, ...prev])
      }
    },
    onUpdate: (row) => {
      if (row.status !== 'active') {
        setProjects(prev => prev.filter(p => p.id !== row.id))
      } else {
        setProjects(prev => prev.map(p => p.id === row.id ? row : p))
      }
    },
    onDelete: (id) => setProjects(prev => prev.filter(p => p.id !== id)),
  })

  useRealtime<Invoice>({
    table: 'invoices',
    userId,
    onInsert: (row) => {
      if (['unpaid', 'partial', 'overdue'].includes(row.status)) {
        setInvoices(prev => prev.some(i => i.id === row.id) ? prev : [...prev, row])
      }
    },
    onUpdate: (row) => {
      if (!['unpaid', 'partial', 'overdue'].includes(row.status)) {
        setInvoices(prev => prev.filter(i => i.id !== row.id))
      } else {
        setInvoices(prev => prev.map(i => i.id === row.id ? row : i))
      }
    },
    onDelete: (id) => setInvoices(prev => prev.filter(i => i.id !== id)),
  })

  useRealtime<Note>({
    table: 'notes',
    userId,
    onInsert: (row) => {
      if (!row.is_archived) {
        setNotes(prev => {
          if (prev.some(n => n.id === row.id)) return prev
          return [row, ...prev].slice(0, 5)
        })
      }
    },
    onUpdate: (row) => {
      if (row.is_archived) {
        setNotes(prev => prev.filter(n => n.id !== row.id))
      } else {
        setNotes(prev => {
          const exists = prev.some(n => n.id === row.id)
          if (exists) return prev.map(n => n.id === row.id ? row : n)
          return [row, ...prev].slice(0, 5)
        })
      }
    },
    onDelete: (id) => setNotes(prev => prev.filter(n => n.id !== id)),
  })

  // Derived data
  const todayTasks = useMemo(() => {
    const todayDate = new Date()
    return tasks.filter(t => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d.getFullYear() === todayDate.getFullYear() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getDate() === todayDate.getDate()
    })
  }, [tasks])

  const overdueTasks = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false
      return new Date(t.due_date) < todayStart
    })
  }, [tasks])

  const projectsWithProgress = useMemo(() => {
    return projects.map(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id)
      const done = pTasks.filter(t => t.status === 'done').length
      const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0
      return { ...p, progress, taskCount: pTasks.length }
    })
  }, [projects, tasks])

  const invoiceSummary = useMemo(() => {
    const summary = { TRY: 0, USD: 0, EUR: 0 }
    invoices.forEach(inv => {
      summary[inv.currency as keyof typeof summary] += Number(inv.amount)
    })
    return summary
  }, [invoices])

  const now = new Date()
  const hasInvoice = invoiceSummary.TRY > 0 || invoiceSummary.USD > 0 || invoiceSummary.EUR > 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {format(now, "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Hoş geldin 👋
        </h1>
      </div>

      {/* Overdue Warning */}
      {overdueTasks.length > 0 && (
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 24,
          }}
        >
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontSize: 14, color: '#EF4444', fontWeight: 500 }}>
            {overdueTasks.length} gecikmiş görevin var
          </span>
          <Link
            href="/gorevler?filter=overdue"
            style={{ marginLeft: 'auto', fontSize: 13, color: '#EF4444', textDecoration: 'underline' }}
          >
            Göster
          </Link>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
        }}
      >
        {/* Bugünün Görevleri */}
        <div className="card" style={{ padding: 20 }}>
          <SectionHeader
            title="Bugünün Görevleri"
            href="/gorevler"
            count={todayTasks.length}
          />
          {todayTasks.length === 0 ? (
            <EmptyState message="Bugün için görev yok. Harika! 🎉" />
          ) : (
            <div>
              {todayTasks.slice(0, 5).map(t => <TaskItem key={t.id} task={t} />)}
              {todayTasks.length > 5 && (
                <Link
                  href="/gorevler"
                  style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--accent)', marginTop: 12, textDecoration: 'none' }}
                >
                  +{todayTasks.length - 5} görev daha
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Aktif Projeler */}
        <div className="card" style={{ padding: 20 }}>
          <SectionHeader
            title="Aktif Projeler"
            href="/projeler"
            count={projectsWithProgress.length}
          />
          {projectsWithProgress.length === 0 ? (
            <EmptyState message="Henüz aktif proje yok." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projectsWithProgress.slice(0, 4).map(p => (
                <Link
                  key={p.id}
                  href={`/projeler/${p.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: p.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {p.name}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.progress}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${p.progress}%`,
                          backgroundColor: p.color,
                          borderRadius: 2,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      {p.taskCount} görev
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bekleyen Alacaklar */}
        <div className="card" style={{ padding: 20 }}>
          <SectionHeader title="Bekleyen Alacaklar" href="/alacaklar" />
          {!hasInvoice ? (
            <EmptyState message="Bekleyen alacak yok." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {invoiceSummary.TRY > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Türk Lirası</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                    ₺{invoiceSummary.TRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {invoiceSummary.USD > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Dolar</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                    ${invoiceSummary.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {invoiceSummary.EUR > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Euro</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                    €{invoiceSummary.EUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Son Notlar */}
        <div className="card" style={{ padding: 20 }}>
          <SectionHeader title="Son Notlar" href="/notlar" count={notes.length} />
          {notes.length === 0 ? (
            <EmptyState message="Henüz not yok." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.map(note => (
                <Link
                  key={note.id}
                  href={`/notlar/${note.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>
                      {note.is_pinned && <span style={{ marginRight: 4 }}>📌</span>}
                      {note.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {format(new Date(note.updated_at), 'd MMM HH:mm', { locale: tr })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
