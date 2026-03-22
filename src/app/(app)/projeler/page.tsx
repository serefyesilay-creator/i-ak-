export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjelerClient from '@/components/projeler/ProjelerClient'

export default async function ProjelerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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
    <ProjelerClient
      initialProjects={projects ?? []}
      taskCounts={taskCounts}
    />
  )
}
