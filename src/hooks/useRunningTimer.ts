'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const TIMER_CHANGED_EVENT = 'isakisi:timer-changed'

/** Zaman Takibi sayfası sayaç başlatınca/durdurunca çağırır; menüdeki sayaç yenilenir. */
export function notifyTimerChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TIMER_CHANGED_EVENT))
}

interface RunningTimer {
  startedAt: string
  clientName: string
}

/** Açık kalan (ended_at boş) zaman kaydını ve geçen süreyi verir. */
export function useRunningTimer() {
  const [running, setRunning] = useState<RunningTimer | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const { data: entry } = await supabase
        .from('time_entries')
        .select('client_id, started_at')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (!entry) { setRunning(null); return }
      const { data: client } = await supabase.from('clients').select('name').eq('id', entry.client_id).maybeSingle()
      if (cancelled) return
      setRunning({ startedAt: entry.started_at, clientName: client?.name ?? 'Müşteri' })
    }

    load()
    window.addEventListener(TIMER_CHANGED_EVENT, load)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener(TIMER_CHANGED_EVENT, load)
      window.removeEventListener('focus', load)
    }
  }, [pathname])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const seconds = running ? Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000)) : 0
  return { running, seconds }
}

export function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
