export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ProjeDetayClient from '@/components/projeler/ProjeDetayClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjeDetayPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [projectRes, columnsRes, tasksRes, milestonesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('kanban_columns').select('*').eq('project_id', id).order('order'),
    supabase.from('tasks').select('*').eq('project_id', id).eq('user_id', user.id).order('created_at'),
    supabase.from('milestones').select('*').eq('project_id', id).eq('user_id', user.id).order('due_date'),
  ])

  if (projectRes.error || !projectRes.data) notFound()

  return (
    <ProjeDetayClient
      project={projectRes.data}
      initialColumns={columnsRes.data ?? []}
      initialTasks={tasksRes.data ?? []}
      initialMilestones={milestonesRes.data ?? []}
    />
  )
}
