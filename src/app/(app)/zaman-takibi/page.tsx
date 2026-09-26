export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ZamanTakibiClient from '@/components/zaman-takibi/ZamanTakibiClient'
import { startOfMonth } from 'date-fns'

export default async function ZamanTakibiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const monthStart = startOfMonth(new Date()).toISOString()

  const [clientsRes, entriesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
    supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', monthStart)
      .order('started_at', { ascending: false }),
  ])

  return (
    <ZamanTakibiClient
      initialClients={clientsRes.data ?? []}
      initialEntries={entriesRes.data ?? []}
    />
  )
}
