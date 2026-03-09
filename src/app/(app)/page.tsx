export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Dashboard verileri paralel yükle
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

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

  const tasks = tasksRes.data ?? []
  const projects = projectsRes.data ?? []
  const pendingInvoices = invoicesRes.data ?? []
  const recentNotes = notesRes.data ?? []

  // Bugünün görevleri
  const todayTasks = tasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    const todayDate = new Date()
    return d.getFullYear() === todayDate.getFullYear() &&
      d.getMonth() === todayDate.getMonth() &&
      d.getDate() === todayDate.getDate()
  })

  // Gecikmiş görevler
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false
    return new Date(t.due_date) < new Date(todayStr)
  })

  // Proje tamamlanma yüzdeleri
  let projectsWithProgress = projects
  if (projects.length > 0) {
    const projectIds = projects.map(p => p.id)
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('project_id, status')
      .eq('user_id', user.id)
      .in('project_id', projectIds)

    projectsWithProgress = projects.map(p => {
      const pTasks = allTasks?.filter(t => t.project_id === p.id) ?? []
      const done = pTasks.filter(t => t.status === 'done').length
      const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0
      return { ...p, progress, taskCount: pTasks.length }
    })
  }

  // Alacak özeti
  const invoiceSummary = { TRY: 0, USD: 0, EUR: 0 }
  pendingInvoices.forEach(inv => {
    invoiceSummary[inv.currency as keyof typeof invoiceSummary] += Number(inv.amount)
  })

  return (
    <DashboardClient
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      activeProjects={projectsWithProgress}
      invoiceSummary={invoiceSummary}
      recentNotes={recentNotes}
    />
  )
}
