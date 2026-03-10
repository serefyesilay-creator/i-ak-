export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [tasksRes, projectsRes, invoicesRes, notesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true }),
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['unpaid', 'partial', 'overdue']),
    supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  return (
    <DashboardClient
      userId={user.id}
      allTasks={tasksRes.data ?? []}
      activeProjects={projectsRes.data ?? []}
      pendingInvoices={invoicesRes.data ?? []}
      recentNotes={notesRes.data ?? []}
    />
  )
}
