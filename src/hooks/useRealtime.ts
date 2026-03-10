'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeOptions<T extends { id: string }> {
  table: string
  userId: string
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (id: string) => void
}

export function useRealtime<T extends { id: string }>({
  table,
  userId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    const channelName = `realtime-${table}-${userId}`

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        {
          event: '*' as ChangeEvent,
          schema: 'public',
          table,
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T)
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T)
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete((payload.old as { id: string }).id)
          }
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [table, userId])
}
