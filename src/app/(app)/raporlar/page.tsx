export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RaporlarClient from '@/components/raporlar/RaporlarClient'

export default async function RaporlarPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const [tasksRes, projectsRes, invoicesRes, clientsRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, created_at, project_id')
            .eq('user_id', user.id),
        supabase
            .from('projects')
            .select('id, name, color, status')
            .eq('user_id', user.id),
        supabase
            .from('invoices')
            .select('id, amount, currency, status, due_date, client_id, created_at')
            .eq('user_id', user.id),
        supabase
            .from('clients')
            .select('id, name, company')
            .eq('user_id', user.id),
    ])

    return (
        <RaporlarClient
            tasks={tasksRes.data ?? []}
            projects={projectsRes.data ?? []}
            invoices={invoicesRes.data ?? []}
            clients={clientsRes.data ?? []}
        />
    )
}
