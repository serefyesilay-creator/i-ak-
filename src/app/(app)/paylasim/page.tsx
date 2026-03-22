export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaylasimClient from '@/components/paylasim/PaylasimClient'

export default async function PaylasimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [clientsRes, sharesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
    supabase.from('content_shares').select('*').eq('user_id', user.id),
  ])

  return (
    <PaylasimClient
      initialClients={clientsRes.data ?? []}
      initialShares={sharesRes.data ?? []}
    />
  )
}
