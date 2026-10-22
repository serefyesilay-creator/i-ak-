'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Square, Play, Plus, X, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { differenceInSeconds, startOfMonth, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Client, TimeEntry } from '@/types'
import { notifyTimerChanged } from '@/hooks/useRunningTimer'

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

  // Bitiş saatini düzelt (açık kalan zamanlayıcı) + kayıt düzenleme
  const [showFixEnd, setShowFixEnd] = useState(false)
  const [fixEndTime, setFixEndTime] = useState('')
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const running = useMemo(() => entries.find(e => e.ended_at === null) ?? null, [entries])

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => setNow(new Date()), 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  async function startTracking(clientId: string) {
    if (running?.client_id === clientId) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Oturum bulunamadı'); return }

    if (running) {
      await supabase.from('time_entries').update({ ended_at: new Date().toISOString() }).eq('id', running.id)
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({ user_id: user.id, client_id: clientId, started_at: new Date().toISOString() })
      .select()
      .single()

    if (error) { toast.error(`Başlatılamadı: ${error.message}`); return }

    setEntries(prev => {
      const withoutOldRunning = running ? prev.map(e => e.id === running.id ? { ...e, ended_at: new Date().toISOString() } : e) : prev
      return [data as TimeEntry, ...withoutOldRunning]
    })
    notifyTimerChanged()
    toast.success('Başladı')
  }

  async function stopTracking() {
    if (!running) return
    const endedAt = new Date().toISOString()
    const { error } = await supabase.from('time_entries').update({ ended_at: endedAt }).eq('id', running.id)
    if (error) { toast.error(`Durdurulamadı: ${error.message}`); return }
    setEntries(prev => prev.map(e => e.id === running.id ? { ...e, ended_at: endedAt } : e))
    notifyTimerChanged()
    toast.success('Durduruldu')
  }

  // Zamanlayıcı açık unutulduysa: gerçek bitiş saatini seçip öyle durdur
  function openFixEnd() {
    setFixEndTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    setShowFixEnd(true)
  }

  async function stopAt() {
    if (!running) return
    const end = new Date(fixEndTime)
    if (isNaN(end.getTime())) { toast.error('Geçerli bir saat seç'); return }
    if (end <= new Date(running.started_at)) { toast.error('Bitiş, başlangıçtan sonra olmalı'); return }
    if (end > new Date()) { toast.error('Bitiş saati gelecekte olamaz'); return }
    const endedAt = end.toISOString()
    const { error } = await supabase.from('time_entries').update({ ended_at: endedAt }).eq('id', running.id)
    if (error) { toast.error(`Kaydedilemedi: ${error.message}`); return }
    setEntries(prev => prev.map(e => e.id === running.id ? { ...e, ended_at: endedAt } : e))
    setShowFixEnd(false)
    notifyTimerChanged()
    toast.success(`${format(end, 'HH:mm')} itibarıyla durduruldu`)
  }

  function openEdit(e: TimeEntry) {
    const secs = Math.max(0, differenceInSeconds(new Date(e.ended_at!), new Date(e.started_at)))
    setEditHours(String(Math.floor(secs / 3600)))
    setEditMinutes(String(Math.floor((secs % 3600) / 60)))
    setEditing(e)
  }

  async function saveEdit() {
    if (!editing) return
    const h = parseInt(editHours || '0', 10)
    const m = parseInt(editMinutes || '0', 10)
    const totalMinutes = h * 60 + m
    if (isNaN(totalMinutes) || totalMinutes <= 0) { toast.error('Süre gir'); return }
    const endedAt = new Date(new Date(editing.started_at).getTime() + totalMinutes * 60 * 1000).toISOString()
    const { error } = await supabase.from('time_entries').update({ ended_at: endedAt }).eq('id', editing.id)
    if (error) { toast.error(`Kaydedilemedi: ${error.message}`); return }
    setEntries(prev => prev.map(e => e.id === editing.id ? { ...e, ended_at: endedAt } : e))
    setEditing(null)
    toast.success('Süre güncellendi')
  }

  async function deleteEntry(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return }
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (error) { toast.error(`Silinemedi: ${error.message}`); return }
    setEntries(prev => prev.filter(e => e.id !== id))
    setConfirmDeleteId(null)
    toast.success('Kayıt silindi')
  }

  async function addManualEntry() {
    const h = parseInt(manualHours || '0', 10)
    const m = parseInt(manualMinutes || '0', 10)
    const totalMinutes = h * 60 + m

    if (!manualClientId) { toast.error('Müşteri seç'); return }
    if (totalMinutes <= 0) { toast.error('Süre gir'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Oturum bulunamadı'); return }

    setSavingManual(true)
    const startedAt = new Date(`${manualDate}T12:00:00`)
    const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000)

    const { data, error } = await supabase
      .from('time_entries')
      .insert({ user_id: user.id, client_id: manualClientId, started_at: startedAt.toISOString(), ended_at: endedAt.toISOString() })
      .select()
      .single()

    setSavingManual(false)
    if (error) { toast.error(`Eklenemedi: ${error.message}`); return }

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

  const LONG_RUN_SECONDS = 4 * 3600
  const recentEntries = useMemo(
    () => entries.filter(e => e.ended_at !== null)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 15),
    [entries],
  )
  const inputStyle = {
    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14,
  } as const

  return (
    <div style={{ paddingBottom: 100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Zaman Takibi</h1>
          <p className="page-sub">
            {format(new Date(), 'MMMM', { locale: tr })} ayında toplam <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDuration(totalMonthSeconds)}</b>
          </p>
        </div>
        <button className="btn" onClick={() => setShowManual(true)}>
          <Plus size={15} /> Elle saat ekle
        </button>
      </div>

      <div className="timer-grid">
      <div>

      {/* Çalışıyor durumu */}
      {running && runningClient && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.16), rgba(var(--accent-rgb),0.04) 60%)', border: '1px solid rgba(var(--accent-rgb),0.55)', borderRadius: 'var(--radius-lg)',
          padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="live-dot" aria-hidden /> Şu an çalışıyor
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{runningClient.name}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {String(Math.floor(runningSeconds / 3600)).padStart(2, '0')}:
              {String(Math.floor((runningSeconds % 3600) / 60)).padStart(2, '0')}:
              {String(runningSeconds % 60).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Başlangıç: {format(new Date(running.started_at), 'd MMM HH:mm', { locale: tr })}
            </div>
            {runningSeconds >= LONG_RUN_SECONDS && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--warning, #F59E0B)', fontWeight: 600 }}>
                <AlertTriangle size={14} /> {Math.floor(runningSeconds / 3600)} saattir açık — unuttun mu?
              </div>
            )}
            <button
              onClick={openFixEnd}
              style={{
                marginTop: 8, background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Pencil size={13} /> Unuttum, bitiş saatini düzelt
            </button>
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

      {!running && (
        <div className="panel" style={{ padding: '22px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sayaç kapalı</div>
          <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--border-strong)', marginTop: 6 }}>00:00:00</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Başlatmak için aşağıdan bir müşteri seç.</div>
        </div>
      )}

      {/* Müşteri butonları */}
      <div className="group-title" style={{ padding: '0 0 10px' }}>
        <b>Müşteriler</b> {running ? 'değiştirmek için dokun' : 'başlatmak için dokun'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 28 }}>
        {clients.map(c => {
          const isRunning = running?.client_id === c.id
          const monthSecs = monthlyTotals.find(t => t.client?.id === c.id)?.seconds ?? 0
          return (
            <button
              key={c.id}
              onClick={() => startTracking(c.id)}
              aria-pressed={isRunning}
              className="client-tile"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {isRunning ? <span className="live-dot" aria-hidden /> : <Play size={14} className="client-tile-play" />}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              </span>
              <span className="num" style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, paddingLeft: 22 }}>
                {monthSecs > 0 ? `Bu ay ${formatDuration(monthSecs)}` : 'Bu ay kayıt yok'}
              </span>
            </button>
          )
        })}
        {clients.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: 13 }}>
            Önce Alacaklar sayfasından müşteri ekle.
          </div>
        )}
      </div>

      </div>

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

      {/* Bitiş saatini düzelt modal */}
      {showFixEnd && running && (
        <>
          <div onClick={() => setShowFixEnd(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 71,
            background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Gerçek bitiş saati</span>
              <button onClick={() => setShowFixEnd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              {runningClient?.name} · başlangıç {format(new Date(running.started_at), 'd MMM HH:mm', { locale: tr })}. İşi bitirdiğin saati seç; zamanlayıcı o saatte durmuş sayılır.
            </div>
            <input type="datetime-local" value={fixEndTime} onChange={e => setFixEndTime(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            {fixEndTime && !isNaN(new Date(fixEndTime).getTime()) && new Date(fixEndTime) > new Date(running.started_at) && (
              <div style={{ fontSize: 12.5, color: 'var(--accent-soft)', marginBottom: 14, fontWeight: 600 }}>
                Kaydedilecek süre: {formatDuration(differenceInSeconds(new Date(fixEndTime), new Date(running.started_at)))}
              </div>
            )}
            <button onClick={stopAt} style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Bu saatte durdur
            </button>
          </div>
        </>
      )}

      {/* Kayıt düzenleme modal */}
      {editing && (
        <>
          <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 71,
            background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Süreyi düzelt</span>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              {clients.find(c => c.id === editing.client_id)?.name ?? '—'} · {format(new Date(editing.started_at), 'd MMM HH:mm', { locale: tr })}. Gerçekte ne kadar çalıştığını yaz.
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input type="number" min="0" placeholder="0" value={editHours} onChange={e => setEditHours(e.target.value)} style={inputStyle} />
                <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: 'var(--text-secondary)' }}>saat</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input type="number" min="0" max="59" placeholder="0" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} style={inputStyle} />
                <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: 'var(--text-secondary)' }}>dk</span>
              </div>
            </div>
            <button onClick={saveEdit} style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Kaydet
            </button>
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bu ayın özeti */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{format(new Date(), 'MMMM', { locale: tr })} dağılımı</h2>
          <span className="num" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDuration(totalMonthSeconds)}</span>
        </div>
        {monthlyTotals.length === 0 ? (
          <div className="panel-empty">Bu ay henüz kayıt yok.</div>
        ) : (
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {monthlyTotals.map(({ client, seconds }) => (
              <div key={client!.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{client!.name}</span>
                  <span className="num" style={{ color: 'var(--text-secondary)' }}>
                    {formatDuration(seconds)} · %{Math.round((seconds / Math.max(totalMonthSeconds, 1)) * 100)}
                  </span>
                </div>
                <div className="bar"><span style={{ width: `${(seconds / Math.max(totalMonthSeconds, 1)) * 100}%`, background: running?.client_id === client!.id ? 'var(--mark)' : 'var(--accent-soft)' }} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Son kayıtlar — süre düzelt / sil */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Son kayıtlar</h2>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Yanlış süreyi düzelt veya sil</span>
        </div>
      <div>
        {recentEntries.length === 0 && (
          <div className="panel-empty">Henüz tamamlanmış kayıt yok.</div>
        )}
        {recentEntries.map(e => {
          const secs = Math.max(0, differenceInSeconds(new Date(e.ended_at!), new Date(e.started_at)))
          const long = secs >= LONG_RUN_SECONDS
          return (
            <div
              key={e.id}
              className="row"
              style={{ alignItems: 'center', gap: 10, padding: '10px 14px 10px 18px' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clients.find(c => c.id === e.client_id)?.name ?? '—'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {format(new Date(e.started_at), 'd MMM HH:mm', { locale: tr })} – {format(new Date(e.ended_at!), 'HH:mm')}
                </div>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: long ? 'var(--warning, #F59E0B)' : 'var(--accent-soft)', whiteSpace: 'nowrap' }} title={long ? 'Uzun kayıt — açık mı kaldı?' : undefined}>
                {long && '⚠ '}{formatDuration(secs)}
              </span>
              <button onClick={() => openEdit(e)} title="Süreyi düzelt" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                <Pencil size={15} />
              </button>
              <button
                onClick={() => deleteEntry(e.id)}
                onBlur={() => confirmDeleteId === e.id && setConfirmDeleteId(null)}
                title={confirmDeleteId === e.id ? 'Silmek için tekrar dokun' : 'Sil'}
                style={{
                  background: confirmDeleteId === e.id ? 'var(--error)' : 'none', border: 'none', borderRadius: 6,
                  color: confirmDeleteId === e.id ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px',
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Trash2 size={14} />{confirmDeleteId === e.id && 'Emin misin?'}
              </button>
            </div>
          )
        })}
      </div>
      </section>
      </div>
      </div>
    </div>
  )
}
