export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AlacaklarClient from '@/components/alacaklar/AlacaklarClient'

export default async function AlacaklarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [clientsRes, invoicesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
    supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <AlacaklarClient
      initialClients={clientsRes.data ?? []}
      initialInvoices={invoicesRes.data ?? []}
    />
  )
}
