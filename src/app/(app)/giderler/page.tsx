export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GiderlerClient from '@/components/giderler/GiderlerClient'

export default async function GiderlerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })

  return <GiderlerClient initialExpenses={expenses ?? []} />
}
