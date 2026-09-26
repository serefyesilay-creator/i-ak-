'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Play, Square, Timer, Clock, Plus, X } from 'lucide-react'
import { differenceInSeconds, startOfMonth, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Client, TimeEntry } from '@/types'

interface Props {
  initialClients: Client[]
  initialEntries: TimeEntry[]
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m} dk`
  return `${h} sa ${m} dk`
}

export default function ZamanTakibiClient({ initialClients, initialEntries }: Props) {
  const [clients] = useState<Client[]>(initialClients)
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [now, setNow] = useState(new Date())
  const supabase = createClient()
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showManual, setShowManual] = useState(false)
  const [manualClientId, setManualClientId] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualDate, setManualDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [savingManual, setSavingManual] = useState(false)

  const running = useMemo(() => entries.find(e => e.ended_at === null) ?? null, [entries])

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => setNow(new Date()), 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  async function startTracking(clientId: string) {
    if (running?.client_id === clientId) return

    if (running) {
      await supabase.from('time_entries').update({ ended_at: new Date().toISOString() }).eq('id', running.id)
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({ client_id: clientId, started_at: new Date().toISOString() })
      .select()
      .single()

    if (error) { toast.error('Başlatılamadı'); return }

    setEntries(prev => {
      const withoutOldRunning = running ? prev.map(e => e.id === running.id ? { ...e, ended_at: new Date().toISOString() } : e) : prev
      return [data as TimeEntry, ...withoutOldRunning]
    })
    toast.success('Başladı')
  }

  async function stopTracking() {
    if (!running) return
    const endedAt = new Date().toISOString()
    const { error } = await supabase.from('time_entries').update({ ended_at: endedAt }).eq('id', running.id)
    if (error) { toast.error('Durdurulamadı'); return }
    setEntries(prev => prev.map(e => e.id === running.id ? { ...e, ended_at: endedAt } : e))
    toast.success('Durduruldu')
  }

  async function addManualEntry() {
    const h = parseInt(manualHours || '0', 10)
    const m = parseInt(manualMinutes || '0', 10)
    const totalMinutes = h * 60 + m

    if (!manualClientId) { toast.error('Müşteri seç'); return }
    if (totalMinutes <= 0) { toast.error('Süre gir'); return }

    setSavingManual(true)
    const startedAt = new Date(`${manualDate}T12:00:00`)
    const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000)

    const { data, error } = await supabase
      .from('time_entries')
      .insert({ client_id: manualClientId, started_at: startedAt.toISOString(), ended_at: endedAt.toISOString() })
      .select()
      .single()

    setSavingManual(false)
    if (error) { toast.error('Eklenemedi'); return }

    setEntries(prev => [data as TimeEntry, ...prev])
    toast.success('Süre eklendi')
    setShowManual(false)
    setManualClientId('')
    setManualHours('')
    setManualMinutes('')
    setManualDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const runningClient = running ? clients.find(c => c.id === running.client_id) : null
  const runningSeconds = running ? differenceInSeconds(now, new Date(running.started_at)) : 0

  const monthlyTotals = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    const totals = new Map<string, number>()
    for (const e of entries) {
      if (new Date(e.started_at) < monthStart) continue
      const end = e.ended_at ? new Date(e.ended_at) : now
      const seconds = Math.max(0, differenceInSeconds(end, new Date(e.started_at)))
      totals.set(e.client_id, (totals.get(e.client_id) ?? 0) + seconds)
    }
    return [...totals.entries()]
      .map(([clientId, seconds]) => ({
        client: clients.find(c => c.id === clientId),
        seconds,
      }))
      .filter(t => t.client)
      .sort((a, b) => b.seconds - a.seconds)
  }, [entries, clients, now])

  const totalMonthSeconds = monthlyTotals.reduce((sum, t) => sum + t.seconds, 0)

  return (
    <div style={{ padding: '20px 16px 100px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Timer size={22} color="var(--accent)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Zaman Takibi</h1>
      </div>

      {/* Çalışıyor durumu */}
      {running && runningClient && (
        <div style={{
          background: 'rgba(99,102,241,0.12)', border: '1px solid var(--accent)', borderRadius: 14,
          padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Şu an çalışıyor</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{runningClient.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {String(Math.floor(runningSeconds / 3600)).padStart(2, '0')}:
              {String(Math.floor((runningSeconds % 3600) / 60)).padStart(2, '0')}:
              {String(runningSeconds % 60).padStart(2, '0')}
            </div>
          </div>
          <button
            onClick={stopTracking}
            style={{
              background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 999,
              width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
            title="Durdur"
          >
            <Square size={22} fill="#fff" />
          </button>
        </div>
      )}

      {/* Müşteri butonları */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 600 }}>
        Müşteri seç {running ? '(değiştirmek için tıkla)' : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 28 }}>
        {clients.map(c => {
          const isRunning = running?.client_id === c.id
          return (
            <button
              key={c.id}
              onClick={() => startTracking(c.id)}
              style={{
                background: isRunning ? 'var(--accent)' : 'var(--bg-card)',
                border: `1px solid ${isRunning ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {isRunning ? <Square size={15} fill="#fff" color="#fff" /> : <Play size={15} color="var(--text-secondary)" />}
              <span style={{ fontSize: 13.5, fontWeight: 600, color: isRunning ? '#fff' : 'var(--text-primary)' }}>{c.name}</span>
            </button>
          )
        })}
        {clients.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: 13 }}>
            Önce Alacaklar sayfasından müşteri ekle.
          </div>
        )}
      </div>

      <button
        onClick={() => setShowManual(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
          border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 14px',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          marginBottom: 28, width: '100%', justifyContent: 'center',
        }}
      >
        <Plus size={15} /> Elle Saat Ekle
      </button>

      {/* Elle saat ekleme modal */}
      {showManual && (
        <>
          <div onClick={() => setShowManual(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 71,
            background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Elle Saat Ekle</span>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Müşteri</div>
            <select
              value={manualClientId}
              onChange={e => setManualClientId(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14, marginBottom: 14,
              }}
            >
              <option value="">Seç...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Tarih</div>
            <input
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14, marginBottom: 14,
              }}
            />

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Süre</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="number" min="0" placeholder="0"
                  value={manualHours}
                  onChange={e => setManualHours(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14,
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: 'var(--text-secondary)' }}>saat</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="number" min="0" max="59" placeholder="0"
                  value={manualMinutes}
                  onChange={e => setManualMinutes(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14,
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: 'var(--text-secondary)' }}>dk</span>
              </div>
            </div>

            <button
              onClick={addManualEntry}
              disabled={savingManual}
              style={{
                width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 14, fontWeight: 700, cursor: savingManual ? 'default' : 'pointer',
                opacity: savingManual ? 0.6 : 1,
              }}
            >
              {savingManual ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </>
      )}

      {/* Bu ayın özeti */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Clock size={15} color="var(--text-secondary)" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {format(new Date(), 'MMMM yyyy', { locale: tr })} — Toplam {formatDuration(totalMonthSeconds)}
        </span>
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {monthlyTotals.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--text-secondary)' }}>Bu ay henüz kayıt yok.</div>
        )}
        {monthlyTotals.map(({ client, seconds }, i) => (
          <div
            key={client!.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: i < monthlyTotals.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{client!.name}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{formatDuration(seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
