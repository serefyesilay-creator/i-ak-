export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RaporlarClient from '@/components/raporlar/RaporlarClient'

export default async function RaporlarPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
    const since = twelveMonthsAgo.toISOString().slice(0, 10)

    const [tasksRes, projectsRes, invoicesRes, clientsRes, expensesRes, assetsRes, snapshotsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, status, priority, due_date, created_at, project_id').eq('user_id', user.id),
        supabase.from('projects').select('id, name, color, status').eq('user_id', user.id),
        supabase.from('invoices').select('id, amount, currency, status, due_date, client_id, created_at').eq('user_id', user.id),
        supabase.from('clients').select('id, name, company').eq('user_id', user.id),
        supabase.from('expenses').select('id, amount, currency, category, expense_date').eq('user_id', user.id),
        supabase.from('assets').select('id, name, category, quantity, unit_price, currency').eq('user_id', user.id),
        supabase.from('asset_snapshots').select('snapshot_date, total_value, breakdown').eq('user_id', user.id).gte('snapshot_date', since).order('snapshot_date', { ascending: true }),
    ])

    return (
        <RaporlarClient
            tasks={tasksRes.data ?? []}
            projects={projectsRes.data ?? []}
            invoices={invoicesRes.data ?? []}
            clients={clientsRes.data ?? []}
            expenses={expensesRes.data ?? []}
            assets={assetsRes.data ?? []}
            assetSnapshots={snapshotsRes.data ?? []}
        />
    )
}
