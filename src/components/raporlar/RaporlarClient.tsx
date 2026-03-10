'use client'

import { useMemo } from 'react'
import {
    BarChart3, TrendingUp, TrendingDown, CheckCircle2,
    AlertCircle, Wallet, FolderKanban, Target,
} from 'lucide-react'
import { format, subMonths, isSameMonth, isBefore, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'

interface TaskItem { id: string; title: string; status: string; priority: string; due_date: string | null; created_at: string; project_id: string | null }
interface ProjectItem { id: string; name: string; color: string; status: string }
interface InvoiceItem { id: string; amount: number; currency: string; status: string; due_date: string | null; client_id: string; created_at: string }
interface ClientItem { id: string; name: string; company: string | null }
interface ExpenseItem { id: string; amount: number; currency: string; category: string; expense_date: string }

interface Props {
    tasks: TaskItem[]
    projects: ProjectItem[]
    invoices: InvoiceItem[]
    clients: ClientItem[]
    expenses: ExpenseItem[]
}

const priorityColors: Record<string, string> = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444', urgent: '#DC2626' }
const priorityLabels: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', urgent: 'Acil' }
const statusLabels: Record<string, string> = { todo: 'Yapılacak', in_progress: 'Devam Eden', done: 'Tamamlanan', cancelled: 'İptal' }
const statusColors: Record<string, string> = { todo: '#F59E0B', in_progress: '#6366F1', done: '#22C55E', cancelled: '#6B7280' }

const CATEGORY_COLORS: Record<string, string> = {
    'Kira': '#6366F1', 'Yazılım': '#8B5CF6', 'Donanım': '#3B82F6', 'Pazarlama': '#EC4899',
    'Ofis': '#14B8A6', 'Fatura': '#F59E0B', 'Maaş': '#22C55E', 'Vergi': '#EF4444',
    'Ulaşım': '#F97316', 'Yemek': '#84CC16', 'Diğer': '#6B7280',
}

export default function RaporlarClient({ tasks, projects, invoices, clients, expenses }: Props) {
    const now = new Date()

    // ── Task Stats ──
    const taskStats = useMemo(() => {
        const total = tasks.length
        const done = tasks.filter(t => t.status === 'done').length
        const inProgress = tasks.filter(t => t.status === 'in_progress').length
        const todo = tasks.filter(t => t.status === 'todo').length
        const overdue = tasks.filter(t => {
            if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
            return isBefore(new Date(t.due_date), now)
        }).length
        return { total, done, inProgress, todo, overdue, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 }
    }, [tasks])

    const priorityDist = useMemo(() => {
        const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 }
        tasks.forEach(t => { if (counts[t.priority] !== undefined) counts[t.priority]++ })
        return counts
    }, [tasks])

    const statusDist = useMemo(() => {
        const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 }
        tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++ })
        return counts
    }, [tasks])

    // ── Monthly Revenue & Expense (last 6 months) ──
    const monthly = useMemo(() => {
        const months: { label: string; month: Date; revenue: number; revenuePaid: number; expense: number }[] = []
        for (let i = 5; i >= 0; i--) {
            const m = startOfMonth(subMonths(now, i))
            const mInvoices = invoices.filter(inv => inv.due_date && isSameMonth(new Date(inv.due_date), m))
            const revenue = mInvoices.reduce((s, inv) => s + Number(inv.amount), 0)
            const revenuePaid = mInvoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + Number(inv.amount), 0)
            const expense = expenses
                .filter(e => isSameMonth(new Date(e.expense_date), m))
                .reduce((s, e) => s + Number(e.amount), 0)
            months.push({ label: format(m, 'MMM', { locale: tr }), month: m, revenue, revenuePaid, expense })
        }
        return months
    }, [invoices, expenses])

    const maxBar = Math.max(...monthly.map(m => Math.max(m.revenue, m.expense)), 1)

    // ── Project Progress ──
    const projectProgress = useMemo(() => {
        return projects.filter(p => p.status === 'active').map(p => {
            const pt = tasks.filter(t => t.project_id === p.id)
            const done = pt.filter(t => t.status === 'done').length
            const pct = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0
            return { ...p, total: pt.length, done, pct }
        }).sort((a, b) => b.pct - a.pct)
    }, [projects, tasks])

    // ── Client Revenue ──
    const clientRevenue = useMemo(() => {
        const map: Record<string, { name: string; total: number; paid: number }> = {}
        invoices.forEach(inv => {
            const client = clients.find(c => c.id === inv.client_id)
            if (!client) return
            if (!map[client.id]) map[client.id] = { name: client.name, total: 0, paid: 0 }
            map[client.id].total += Number(inv.amount)
            if (inv.status === 'paid') map[client.id].paid += Number(inv.amount)
        })
        return Object.values(map).sort((a, b) => b.total - a.total)
    }, [invoices, clients])

    // ── Expense by Category (all time) ──
    const expenseByCat = useMemo(() => {
        const map: Record<string, number> = {}
        expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + Number(e.amount) })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [expenses])

    const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.amount), 0)
    const paidRevenue = invoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + Number(inv.amount), 0)
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const netBalance = paidRevenue - totalExpense

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <BarChart3 size={24} color="var(--accent)" />
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Raporlar & Analitik</h1>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <SummaryCard icon={<Target size={20} color="#6366F1" />} label="Toplam Görev" value={String(taskStats.total)} accent="#6366F1" />
                <SummaryCard icon={<CheckCircle2 size={20} color="#22C55E" />} label="Tamamlanan" value={`${taskStats.completionRate}%`} accent="#22C55E" />
                <SummaryCard icon={<Wallet size={20} color="#F59E0B" />} label="Toplam Gelir" value={`₺${totalRevenue.toLocaleString('tr-TR')}`} accent="#F59E0B" />
                <SummaryCard icon={<TrendingDown size={20} color="#EF4444" />} label="Toplam Gider" value={`₺${totalExpense.toLocaleString('tr-TR')}`} accent="#EF4444" />
            </div>

            {/* ── Net Balance ── */}
            <div className="card" style={{ padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Alınan Gelir</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>₺{paidRevenue.toLocaleString('tr-TR')}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Toplam Gider</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444' }}>₺{totalExpense.toLocaleString('tr-TR')}</div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Net Bakiye</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: netBalance >= 0 ? '#22C55E' : '#EF4444' }}>
                        {netBalance >= 0 ? '+' : ''}₺{netBalance.toLocaleString('tr-TR')}
                    </div>
                </div>
            </div>

            {/* ── Monthly Revenue vs Expense ── */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <h3 style={sectionTitle}>
                    <TrendingUp size={16} style={{ marginRight: 6 }} />
                    Son 6 Ay — Gelir & Gider
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 20, height: 150 }}>
                    {monthly.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 120 }}>
                                {/* Revenue bar */}
                                <div style={{ width: '42%', position: 'relative', height: `${(m.revenue / maxBar) * 100}%`, minHeight: m.revenue > 0 ? 4 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', borderRadius: '3px 3px 0 0', backgroundColor: 'rgba(99,102,241,0.2)' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${m.revenue > 0 ? (m.revenuePaid / m.revenue) * 100 : 0}%`, borderRadius: '3px 3px 0 0', backgroundColor: '#22C55E' }} />
                                </div>
                                {/* Expense bar */}
                                <div style={{ width: '42%', height: `${(m.expense / maxBar) * 100}%`, minHeight: m.expense > 0 ? 4 : 0, backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: '3px 3px 0 0' }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: 2 }}>{m.label}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <LegendDot color="#22C55E" label="Alınan Gelir" />
                    <LegendDot color="rgba(99,102,241,0.4)" label="Toplam Gelir" />
                    <LegendDot color="rgba(239,68,68,0.6)" label="Gider" />
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Status Distribution */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>Görev Durumu</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        {Object.entries(statusDist).map(([status, count]) => (
                            <div key={status}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{statusLabels[status] ?? status}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: statusColors[status] ?? 'var(--text-primary)' }}>{count}</span>
                                </div>
                                <div style={{ height: 8, backgroundColor: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 4, width: `${taskStats.total > 0 ? (count / taskStats.total) * 100 : 0}%`, backgroundColor: statusColors[status] ?? 'var(--accent)', transition: 'width 0.8s ease' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Expense by Category */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>
                        <TrendingDown size={16} style={{ marginRight: 6 }} />
                        Gider Kategorileri
                    </h3>
                    {expenseByCat.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Henüz gider yok.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                            {expenseByCat.map(([cat, amount]) => {
                                const color = CATEGORY_COLORS[cat] ?? '#6B7280'
                                const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0
                                return (
                                    <div key={cat}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                                                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cat}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(pct)}%</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color }}>₺{amount.toLocaleString('tr-TR')}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Project Progress */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>
                        <FolderKanban size={16} style={{ marginRight: 6 }} />
                        Proje İlerlemesi
                    </h3>
                    {projectProgress.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Aktif proje yok.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                            {projectProgress.map(p => (
                                <div key={p.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.color || 'var(--accent)', display: 'inline-block' }} />
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: p.pct >= 100 ? '#22C55E' : 'var(--accent)' }}>
                                            {p.pct}% <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({p.done}/{p.total})</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 3, width: `${p.pct}%`, backgroundColor: p.pct >= 100 ? '#22C55E' : (p.color || 'var(--accent)'), transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Client Revenue */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>
                        <Wallet size={16} style={{ marginRight: 6 }} />
                        Müşteri Gelir Dağılımı
                    </h3>
                    {clientRevenue.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Fatura yok.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                            {clientRevenue.map((c, i) => {
                                const maxClient = clientRevenue[0]?.total ?? 1
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</span>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <span style={{ fontSize: 12, color: '#22C55E' }}>₺{c.paid.toLocaleString('tr-TR')}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ ₺{c.total.toLocaleString('tr-TR')}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 3, width: `${(c.total / maxClient) * 100}%`, background: `linear-gradient(90deg, #22C55E ${(c.paid / c.total) * 100}%, rgba(99,102,241,0.3) ${(c.paid / c.total) * 100}%)`, transition: 'width 0.8s ease' }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Priority Distribution ── */}
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
                <h3 style={sectionTitle}>
                    <AlertCircle size={16} style={{ marginRight: 6 }} />
                    Öncelik Dağılımı
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 16, height: 100 }}>
                    {Object.entries(priorityDist).map(([p, count]) => {
                        const maxP = Math.max(...Object.values(priorityDist), 1)
                        return (
                            <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: priorityColors[p] }}>{count}</span>
                                <div style={{ width: '100%', maxWidth: 40, borderRadius: 4, height: `${(count / maxP) * 60}px`, backgroundColor: priorityColors[p], minHeight: count > 0 ? 8 : 2, opacity: count > 0 ? 1 : 0.3, transition: 'height 0.8s ease' }} />
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{priorityLabels[p]}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
    return (
        <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                {icon}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
        </div>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
    )
}

const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }
