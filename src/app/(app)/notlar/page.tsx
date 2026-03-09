export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotlarClient from '@/components/notlar/NotlarClient'

export default async function NotlarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [notesRes, categoriesRes] = await Promise.all([
    supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('note_categories')
      .select('*')
      .eq('user_id', user.id),
  ])

  return (
    <NotlarClient
      initialNotes={notesRes.data ?? []}
      categories={categoriesRes.data ?? []}
    />
  )
}
