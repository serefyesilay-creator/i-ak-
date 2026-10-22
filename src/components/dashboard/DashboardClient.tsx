'use client'

import { useState, useMemo } from 'react'
import { format, addDays, startOfDay, startOfWeek, isSameDay, differenceInSeconds } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Check, ChevronRight, Pin } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Task, Project, Note, Invoice, Client, TimeEntry } from '@/types'
import { useRealtime } from '@/hooks/useRealtime'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  allTasks: Task[]
  activeProjects: Project[]
  pendingInvoices: Invoice[]
  recentNotes: Note[]
  clients: Client[]
  weekEntries: TimeEntry[]
}

const priorityConfig: Record<Task['priority'], { label: string; color: string; loud: boolean }> = {
  low: { label: 'Düşük', color: '#4ADE80', loud: false },
  medium: { label: 'Orta', color: '#FBBF24', loud: false },
  high: { label: 'Yüksek', color: '#F87171', loud: true },
  urgent: { label: 'Acil', color: '#F87171', loud: true },
}

const currencySymbol: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' }

function money(amount: number, currency = 'TRY') {
  return `${currencySymbol[currency] ?? ''}${Math.round(amount).toLocaleString('tr-TR')}`
}

function hoursLabel(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m} dk`
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`
}

function greeting(d: Date) {
  const h = d.getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

function PanelHead({ title, href, linkLabel = 'Tümü' }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="panel-head">
      <h2 className="panel-title">{title}</h2>
      {href && (
        <Link href={href} className="panel-link">
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

export default function DashboardClient({
  userId,
  allTasks: initialTasks,
  activeProjects: initialProjects,
  pendingInvoices: initialInvoices,
  recentNotes: initialNotes,
  clients,
  weekEntries,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [now] = useState(() => new Date())
  const supabase = createClient()

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

  async function toggleDone(task: Task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    const updatedAt = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus, updated_at: updatedAt } : t))
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus, updated_at: updatedAt })
      .eq('id', task.id)
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.error('Güncellenemedi')
    }
  }

  // ── Ajanda ────────────────────────────────────────────
  const agenda = useMemo(() => {
    const todayStart = startOfDay(now)
    const horizon = addDays(todayStart, 8)
    const withDate = tasks.filter(t => t.due_date)
    const overdue = withDate.filter(t => t.status !== 'done' && new Date(t.due_date!) < todayStart)
    const today = withDate
      .filter(t => isSameDay(new Date(t.due_date!), now))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
    const upcoming = withDate.filter(t => {
      const d = new Date(t.due_date!)
      return t.status !== 'done' && d >= addDays(todayStart, 1) && d < horizon
    })
    const upcomingByDay: { day: Date; tasks: Task[] }[] = []
    for (let i = 1; i < 8; i++) {
      const day = addDays(todayStart, i)
      const dayTasks = upcoming.filter(t => isSameDay(new Date(t.due_date!), day))
      if (dayTasks.length) upcomingByDay.push({ day, tasks: dayTasks })
    }
    const ongoing = tasks.filter(t => !t.due_date && t.status === 'in_progress')
    return { overdue, today, upcomingByDay, ongoing }
  }, [tasks, now])

  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now])

  const weekDone = useMemo(
    () => tasks.filter(t => t.status === 'done' && new Date(t.updated_at) >= weekStart).length,
    [tasks, weekStart],
  )

  // ── Bu haftanın zamanı ───────────────────────────────
  const week = useMemo(() => {
    const perDay = Array.from({ length: 7 }, () => 0)
    const perClient = new Map<string, number>()
    let total = 0
    for (const e of weekEntries) {
      const start = new Date(e.started_at)
      const end = e.ended_at ? new Date(e.ended_at) : now
      const secs = Math.max(0, differenceInSeconds(end, start))
      total += secs
      const dayIdx = (start.getDay() + 6) % 7
      perDay[dayIdx] += secs
      perClient.set(e.client_id, (perClient.get(e.client_id) ?? 0) + secs)
    }
    const clientRows = [...perClient.entries()]
      .map(([id, secs]) => ({ id, secs, name: clients.find(c => c.id === id)?.name ?? 'Müşteri' }))
      .sort((a, b) => b.secs - a.secs)
    return { perDay, total, clientRows, maxDay: Math.max(...perDay, 1) }
  }, [weekEntries, clients, now])

  const projectsWithProgress = useMemo(() => {
    return projects.map(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id)
      const done = pTasks.filter(t => t.status === 'done').length
      const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0
      return { ...p, progress, taskCount: pTasks.length, doneCount: done }
    })
  }, [projects, tasks])

  // Sadece bu ay kesilen (issue_date) bekleyen faturalar
  const monthInvoices = useMemo(
    () => invoices.filter(inv => {
      const d = new Date(inv.issue_date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }),
    [invoices, now],
  )

  const invoiceTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    monthInvoices.forEach(inv => { totals[inv.currency] = (totals[inv.currency] ?? 0) + Number(inv.amount) })
    return Object.entries(totals).filter(([, v]) => v > 0)
  }, [monthInvoices])

  const nextInvoices = useMemo(
    () => [...monthInvoices].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 3),
    [monthInvoices],
  )

  const todayOpen = agenda.today.filter(t => t.status !== 'done').length
  const tryTotal = invoiceTotals.find(([c]) => c === 'TRY')?.[1] ?? 0
  const projectName = (id: string | null) => projects.find(p => p.id === id)

  function renderTaskRow(task: Task, showDate = false) {
    const p = priorityConfig[task.priority]
    const project = projectName(task.project_id)
    const done = task.status === 'done'
    return (
      <div key={task.id} className="row">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
          className={`check ${task.status === 'in_progress' ? 'is-progress' : ''}`}
          onClick={() => toggleDone(task)}
        >
          <Check size={13} strokeWidth={3} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href="/gorevler"
            className="row-title"
            style={{
              textDecoration: done ? 'line-through' : 'none',
              opacity: done ? 0.5 : 1,
              display: 'block',
            }}
          >
            {task.title}
          </Link>
          {(project || task.status === 'in_progress' || showDate) && (
            <div className="row-meta">
              {project && (
                <span><span className="dot" style={{ backgroundColor: project.color }} />{project.name}</span>
              )}
              {task.status === 'in_progress' && <span style={{ color: '#FBBF24' }}>Devam ediyor</span>}
              {showDate && task.due_date && (
                <span style={{ color: '#F87171' }}>{format(new Date(task.due_date), 'd MMM', { locale: tr })}</span>
              )}
            </div>
          )}
        </div>
        {p.loud && !done && <span className="prio" style={{ color: p.color }}>{p.label}</span>}
      </div>
    )
  }

  const agendaEmpty =
    agenda.overdue.length === 0 && agenda.today.length === 0 && agenda.upcomingByDay.length === 0 && agenda.ongoing.length === 0

  return (
    <div>
      {/* Masthead */}
      <header className="masthead">
        <div className="masthead-date">
          <div className="masthead-day">{format(now, 'd')}</div>
          <div className="masthead-day-meta">
            <div className="masthead-weekday">{format(now, 'EEEE', { locale: tr })}</div>
            <div className="masthead-month">{format(now, 'MMMM yyyy', { locale: tr })}</div>
          </div>
        </div>
        <div className="masthead-text">
          <h1 className="masthead-greet">{greeting(now)}.</h1>
          <p className="masthead-summary">
            {todayOpen > 0 ? <>Bugün <b>{todayOpen} görevin</b> var</> : <>Bugün için açık görev yok</>}
            {agenda.overdue.length > 0 ? <>, ayrıca <b className="is-late">{agenda.overdue.length} gecikmiş</b> görev bekliyor.</> : '.'}
            {tryTotal > 0 && <> {format(now, 'MMMM', { locale: tr })} ayında tahsil bekleyen <b>{money(tryTotal)}</b> var.</>}
          </p>
        </div>
      </header>

      {/* Rakam şeridi */}
      <div className="stat-rail">
        <div className="stat">
          <div className="stat-value">{todayOpen}</div>
          <div className="stat-label">Bugün açık görev</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: agenda.overdue.length ? '#F87171' : undefined }}>{agenda.overdue.length}</div>
          <div className="stat-label">Gecikmiş</div>
        </div>
        <div className="stat">
          <div className="stat-value">{weekDone}</div>
          <div className="stat-label">Bu hafta biten</div>
        </div>
        <div className="stat">
          <div className="stat-value">{hoursLabel(week.total)}</div>
          <div className="stat-label">Bu hafta çalışma</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(tryTotal)}</div>
          <div className="stat-label">{format(now, 'MMMM', { locale: tr })} alacağı</div>
        </div>
      </div>

      <div className="today-grid">
        {/* Ajanda */}
        <section className="panel" aria-label="Ajanda">
          <PanelHead title="Ajanda" href="/gorevler" linkLabel="Tüm görevler" />
          {agendaEmpty && <div className="panel-empty">Önümüzdeki 7 gün için tarihli görev yok.</div>}

          {agenda.overdue.length > 0 && (
            <>
              <div className="group-title">
                <span className="tick" style={{ background: '#F87171' }} />
                <b style={{ color: '#F87171' }}>Gecikmiş</b> {agenda.overdue.length}
              </div>
              {agenda.overdue.map(t => renderTaskRow(t, true))}
            </>
          )}

          {agenda.today.length > 0 && (
            <>
              <div className="group-title">
                <span className="tick" style={{ background: 'var(--mark)' }} />
                <b>Bugün</b> {todayOpen}/{agenda.today.length}
              </div>
              {agenda.today.map(t => renderTaskRow(t))}
            </>
          )}

          {agenda.upcomingByDay.map(({ day, tasks: dayTasks }) => (
            <div key={day.toISOString()}>
              <div className="group-title">
                <span className="tick" />
                <b>{isSameDay(day, addDays(now, 1)) ? 'Yarın' : format(day, 'EEEE', { locale: tr })}</b>
                {format(day, 'd MMMM', { locale: tr })}
              </div>
              {dayTasks.map(t => renderTaskRow(t))}
            </div>
          ))}

          {agenda.ongoing.length > 0 && (
            <>
              <div className="group-title">
                <span className="tick" style={{ background: '#FBBF24' }} />
                <b>Tarihsiz, devam eden</b> {agenda.ongoing.length}
              </div>
              {agenda.ongoing.map(t => renderTaskRow(t))}
            </>
          )}
          <div style={{ height: 8 }} />
        </section>

        <div className="today-side">
          {/* Bu hafta zaman */}
          <section className="panel">
            <PanelHead title="Bu hafta" href="/zaman-takibi" linkLabel="Zaman" />
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'end', height: 84 }}>
                {week.perDay.map((secs, i) => {
                  const isToday = i === (now.getDay() + 6) % 7
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                      <div
                        title={hoursLabel(secs)}
                        style={{
                          width: '100%',
                          maxWidth: 26,
                          height: `${Math.max(secs > 0 ? 8 : 3, (secs / week.maxDay) * 62)}px`,
                          borderRadius: 6,
                          background: isToday ? 'var(--mark)' : secs > 0 ? 'var(--accent)' : 'var(--bg-raised)',
                          transition: 'height 0.5s ease',
                        }}
                      />
                      <span style={{ fontSize: 11, color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isToday ? 600 : 400 }}>
                        {format(addDays(weekStart, i), 'EEEEEE', { locale: tr })}
                      </span>
                    </div>
                  )
                })}
              </div>
              {week.clientRows.length === 0 ? (
                <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)' }}>Bu hafta henüz kayıt yok.</p>
              ) : (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {week.clientRows.slice(0, 4).map(c => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        <span className="num" style={{ color: 'var(--text-secondary)' }}>{hoursLabel(c.secs)}</span>
                      </div>
                      <div className="bar"><span style={{ width: `${(c.secs / week.total) * 100}%`, background: 'var(--accent-soft)' }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Alacaklar */}
          <section className="panel">
            <PanelHead title={`${format(now, 'MMMM', { locale: tr })} alacakları`} href="/alacaklar" />
            {invoiceTotals.length === 0 ? (
              <div className="panel-empty">Bu ay kesilmiş bekleyen alacak yok.</div>
            ) : (
              <>
                <div className="panel-body" style={{ paddingBottom: 12 }}>
                  {invoiceTotals.map(([cur, amount]) => (
                    <div key={cur} className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.15 }}>
                      {money(amount, cur)}
                    </div>
                  ))}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{monthInvoices.length} fatura bekliyor</div>
                </div>
                {nextInvoices.map(inv => {
                  const late = inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < startOfDay(now))
                  return (
                    <div key={inv.id} className="row" style={{ alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row-title" style={{ fontSize: 14 }}>{clients.find(c => c.id === inv.client_id)?.name ?? inv.service_name}</div>
                        <div className="row-meta">
                          <span>{inv.service_name}</span>
                          {inv.due_date && (
                            <span style={{ color: late ? '#F87171' : undefined }}>
                              {late ? 'Gecikti · ' : ''}{format(new Date(inv.due_date), 'd MMM', { locale: tr })}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{money(Number(inv.amount), inv.currency)}</span>
                    </div>
                  )
                })}
              </>
            )}
          </section>

          {/* Projeler */}
          <section className="panel">
            <PanelHead title="Aktif projeler" href="/projeler" />
            {projectsWithProgress.length === 0 ? (
              <div className="panel-empty">Henüz aktif proje yok.</div>
            ) : (
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {projectsWithProgress.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/projeler/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span className="num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{p.doneCount}/{p.taskCount}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${p.progress}%`, background: p.color }} /></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Notlar */}
          {notes.length > 0 && (
            <section className="panel">
              <PanelHead title="Son notlar" href="/notlar" />
              {notes.map(note => (
                <Link key={note.id} href={`/notlar/${note.id}`} className="row" style={{ textDecoration: 'none', alignItems: 'center' }}>
                  {note.is_pinned && <Pin size={13} color="var(--mark)" style={{ flexShrink: 0 }} />}
                  <span className="row-title" style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{format(new Date(note.updated_at), 'd MMM', { locale: tr })}</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
