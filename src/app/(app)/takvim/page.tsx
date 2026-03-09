export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TakvimClient from '@/components/takvim/TakvimClient'

export default async function TakvimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [tasksRes, milestonesRes, projectsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, project_id')
      .eq('user_id', user.id)
      .not('due_date', 'is', null)
      .neq('status', 'cancelled'),
    supabase
      .from('milestones')
      .select('id, title, due_date, is_completed, project_id')
      .eq('user_id', user.id)
      .not('due_date', 'is', null),
    supabase
      .from('projects')
      .select('id, name, color')
      .eq('user_id', user.id),
  ])

  return (
    <TakvimClient
      tasks={tasksRes.data ?? []}
      milestones={milestonesRes.data ?? []}
      projects={projectsRes.data ?? []}
    />
  )
}
