export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GorevlerClient from '@/components/gorevler/GorevlerClient'

export default async function GorevlerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [tasksRes, projectsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('id, name, color')
      .eq('user_id', user.id)
      .neq('status', 'archived'),
  ])

  return (
    <GorevlerClient
      initialTasks={tasksRes.data ?? []}
      projects={projectsRes.data ?? []}
    />
  )
}
