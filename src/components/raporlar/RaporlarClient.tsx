'use client'

import { useMemo } from 'react'
import {
    BarChart3,
    TrendingUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    Wallet,
    FolderKanban,
    Target,
} from 'lucide-react'
import { format, subMonths, isSameMonth, isAfter, isBefore, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'

interface TaskItem {
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    created_at: string
    project_id: string | null
}

interface ProjectItem {
    id: string
    name: string
    color: string
    status: string
}

interface InvoiceItem {
    id: string
    amount: number
    currency: string
    status: string
    due_date: string | null
    client_id: string
    created_at: string
}

interface ClientItem {
    id: string
    name: string
    company: string | null
}

interface Props {
    tasks: TaskItem[]
    projects: ProjectItem[]
    invoices: InvoiceItem[]
    clients: ClientItem[]
}

const priorityColors: Record<string, string> = {
    low: '#22C55E',
    medium: '#F59E0B',
    high: '#EF4444',
    urgent: '#DC2626',
}

const priorityLabels: Record<string, string> = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    urgent: 'Acil',
}

const statusLabels: Record<string, string> = {
    todo: 'Yapılacak',
    in_progress: 'Devam Eden',
    done: 'Tamamlanan',
    cancelled: 'İptal',
}

const statusColors: Record<string, string> = {
    todo: '#F59E0B',
    in_progress: '#6366F1',
    done: '#22C55E',
    cancelled: '#6B7280',
}

export default function RaporlarClient({ tasks, projects, invoices, clients }: Props) {
    const now = new Date()

    // ── Task Statistics ──
    const taskStats = useMemo(() => {
        const total = tasks.length
        const done = tasks.filter(t => t.status === 'done').length
        const inProgress = tasks.filter(t => t.status === 'in_progress').length
        const todo = tasks.filter(t => t.status === 'todo').length
        const overdue = tasks.filter(t => {
            if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
            return isBefore(new Date(t.due_date), now)
        }).length
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
        return { total, done, inProgress, todo, overdue, completionRate }
    }, [tasks])

    // ── Priority Distribution ──
    const priorityDist = useMemo(() => {
        const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 }
        tasks.forEach(t => { if (counts[t.priority] !== undefined) counts[t.priority]++ })
        return counts
    }, [tasks])

    // ── Status Distribution ──
    const statusDist = useMemo(() => {
        const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 }
        tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++ })
        return counts
    }, [tasks])

    // ── Monthly Revenue (last 6 months) ──
    const monthlyRevenue = useMemo(() => {
        const months: { label: string; month: Date; total: number; paid: number }[] = []
        for (let i = 5; i >= 0; i--) {
            const m = startOfMonth(subMonths(now, i))
            const monthInvoices = invoices.filter(inv => inv.due_date && isSameMonth(new Date(inv.due_date), m))
            const total = monthInvoices.reduce((s, inv) => s + Number(inv.amount), 0)
            const paid = monthInvoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + Number(inv.amount), 0)
            months.push({ label: format(m, 'MMM', { locale: tr }), month: m, total, paid })
        }
        return months
    }, [invoices])

    const maxRevenue = Math.max(...monthlyRevenue.map(m => m.total), 1)

    // ── Project Progress ──
    const projectProgress = useMemo(() => {
        return projects
            .filter(p => p.status === 'active')
            .map(p => {
                const projectTasks = tasks.filter(t => t.project_id === p.id)
                const total = projectTasks.length
                const done = projectTasks.filter(t => t.status === 'done').length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return { ...p, total, done, pct }
            })
            .sort((a, b) => b.pct - a.pct)
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

    // ── Total Revenue ──
    const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.amount), 0)
    const paidRevenue = invoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + Number(inv.amount), 0)
    const pendingRevenue = totalRevenue - paidRevenue

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
                <SummaryCard icon={<AlertCircle size={20} color="#EF4444" />} label="Geciken" value={String(taskStats.overdue)} accent="#EF4444" />
                <SummaryCard icon={<Wallet size={20} color="#F59E0B" />} label="Toplam Gelir" value={`₺${totalRevenue.toLocaleString('tr-TR')}`} accent="#F59E0B" />
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Status Distribution */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>Görev Durumu Dağılımı</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        {Object.entries(statusDist).map(([status, count]) => (
                            <div key={status}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{statusLabels[status] ?? status}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: statusColors[status] ?? 'var(--text-primary)' }}>{count}</span>
                                </div>
                                <div style={{ height: 8, backgroundColor: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 4,
                                        width: `${taskStats.total > 0 ? (count / taskStats.total) * 100 : 0}%`,
                                        backgroundColor: statusColors[status] ?? 'var(--accent)',
                                        transition: 'width 0.8s ease',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority Distribution */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={sectionTitle}>Öncelik Dağılımı</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 16, height: 120 }}>
                        {Object.entries(priorityDist).map(([p, count]) => {
                            const maxP = Math.max(...Object.values(priorityDist), 1)
                            return (
                                <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: priorityColors[p] }}>{count}</span>
                                    <div style={{
                                        width: '100%', maxWidth: 40, borderRadius: 4,
                                        height: `${(count / maxP) * 80}px`,
                                        backgroundColor: priorityColors[p],
                                        transition: 'height 0.8s ease',
                                        minHeight: count > 0 ? 8 : 2,
                                        opacity: count > 0 ? 1 : 0.3,
                                    }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{priorityLabels[p]}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ── Monthly Revenue Chart ── */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <h3 style={sectionTitle}>
                    <TrendingUp size={16} style={{ marginRight: 6 }} />
                    Son 6 Ay Gelir Takibi
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 20, height: 140 }}>
                    {monthlyRevenue.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {m.total > 0 ? `₺${m.total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '-'}
                            </span>
                            <div style={{ width: '100%', maxWidth: 48, position: 'relative', height: `${(m.total / maxRevenue) * 100}px`, minHeight: 4 }}>
                                {/* Total bar */}
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: '100%', borderRadius: 4,
                                    backgroundColor: 'rgba(99,102,241,0.2)',
                                }} />
                                {/* Paid bar */}
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: `${m.total > 0 ? (m.paid / m.total) * 100 : 0}%`,
                                    borderRadius: 4,
                                    backgroundColor: '#22C55E',
                                    transition: 'height 0.8s ease',
                                }} />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{m.label}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#22C55E', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Alınan</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(99,102,241,0.3)', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Toplam</span>
                    </div>
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
                                            {p.pct}%
                                            <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>({p.done}/{p.total})</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 3,
                                            width: `${p.pct}%`,
                                            backgroundColor: p.pct >= 100 ? '#22C55E' : (p.color || 'var(--accent)'),
                                            transition: 'width 0.8s ease',
                                        }} />
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
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span style={{ fontSize: 12, color: '#22C55E' }}>₺{c.paid.toLocaleString('tr-TR')}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ ₺{c.total.toLocaleString('tr-TR')}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 3,
                                                width: `${(c.total / maxClient) * 100}%`,
                                                background: `linear-gradient(90deg, #22C55E ${(c.paid / c.total) * 100}%, rgba(99,102,241,0.3) ${(c.paid / c.total) * 100}%)`,
                                                transition: 'width 0.8s ease',
                                            }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Revenue Summary Footer ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24 }}>
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>₺{totalRevenue.toLocaleString('tr-TR')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Toplam Gelir</div>
                </div>
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>₺{paidRevenue.toLocaleString('tr-TR')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Alınan</div>
                </div>
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>₺{pendingRevenue.toLocaleString('tr-TR')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Bekleyen</div>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
    return (
        <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
        </div>
    )
}

const sectionTitle: React.CSSProperties = {
    fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
    display: 'flex', alignItems: 'center',
}
