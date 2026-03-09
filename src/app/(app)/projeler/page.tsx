export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'

const statusLabels = {
  active: 'Aktif',
  on_hold: 'Beklemede',
  completed: 'Tamamlandı',
  archived: 'Arşivlendi',
}

const statusColors = {
  active: '#22C55E',
  on_hold: '#F59E0B',
  completed: '#6366F1',
  archived: '#888',
}

export default async function ProjelerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Task counts per project
  const projectIds = (projects ?? []).map(p => p.id)
  let taskCounts: Record<string, { total: number; done: number }> = {}

  if (projectIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('project_id, status')
      .eq('user_id', user.id)
      .in('project_id', projectIds)

    tasks?.forEach(t => {
      if (!taskCounts[t.project_id]) taskCounts[t.project_id] = { total: 0, done: 0 }
      taskCounts[t.project_id].total++
      if (t.status === 'done') taskCounts[t.project_id].done++
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Projeler</h1>
        <Link
          href="/projeler/yeni"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Plus size={16} />
          Yeni Proje
        </Link>
      </div>

      {(!projects || projects.length === 0) ? (
        <div
          className="card"
          style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}
        >
          <FolderKanban size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Henüz proje yok</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>İlk projenizi oluşturun.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const tc = taskCounts[p.id] ?? { total: 0, done: 0 }
            const progress = tc.total > 0 ? Math.round((tc.done / tc.total) * 100) : 0

            return (
              <Link key={p.id} href={`/projeler/${p.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{ padding: 20, transition: 'transform 0.15s, border-color 0.15s', cursor: 'pointer' }}
                >
                  {/* Color stripe */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: `${statusColors[p.status as keyof typeof statusColors]}20`,
                        color: statusColors[p.status as keyof typeof statusColors],
                      }}
                    >
                      {statusLabels[p.status as keyof typeof statusLabels]}
                    </span>
                  </div>

                  {p.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                      {p.description.slice(0, 80)}{p.description.length > 80 ? '...' : ''}
                    </p>
                  )}

                  {/* Progress */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tc.done}/{tc.total} görev</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{progress}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--border)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          backgroundColor: p.color,
                          borderRadius: 2,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
