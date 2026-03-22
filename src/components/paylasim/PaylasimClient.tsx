'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import type { Client, ContentShare } from '@/types'
import { format, getWeek, startOfYear, addWeeks, parse } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'

const COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6', '#F97316']

interface Props {
  initialClients: Client[]
  initialShares: ContentShare[]
}

interface Week {
  weekNumber: number
  startDate: Date
  endDate: Date
}

function getWeeksOf2026(): Week[] {
  const weeks: Week[] = []
  const startDate = new Date(2026, 0, 1)

  for (let i = 1; i <= 53; i++) {
    const weekStart = addWeeks(startOfYear(startDate), i - 1)
    weeks.push({
      weekNumber: i,
      startDate: weekStart,
      endDate: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
    })
  }

  return weeks
}

function getCurrentWeekNumber(): number {
  const today = new Date()
  if (today.getFullYear() !== 2026) return 1
  return getWeek(today, { locale: tr })
}

interface ShareModalState {
  isOpen: boolean
  date?: string
  share?: ContentShare | null
}

export default function PaylasimClient({ initialClients, initialShares }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [shares, setShares] = useState<ContentShare[]>(initialShares)
  const [userId, setUserId] = useState<string>('')
  const [currentWeek, setCurrentWeek] = useState<number>(getCurrentWeekNumber())
  const [shareModal, setShareModal] = useState<ShareModalState>({ isOpen: false })
  const [formData, setFormData] = useState<{
    clientId: string
    title: string
    platform: 'instagram' | 'youtube'
    status: 'planned' | 'ready' | 'published' | 'cancelled'
    isShared: boolean
  }>({
    clientId: '',
    title: '',
    platform: 'instagram',
    status: 'planned',
    isShared: false,
  })

  const weeks = getWeeksOf2026()
  const supabase = createClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Get userId
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // Realtime subscriptions
  useRealtime<Client>({
    table: 'clients',
    userId,
    onInsert: (row) => setClients(prev => [...prev, row]),
    onUpdate: (row) => setClients(prev => prev.map(c => c.id === row.id ? row : c)),
    onDelete: (id) => setClients(prev => prev.filter(c => c.id !== id)),
  })

  useRealtime<ContentShare>({
    table: 'content_shares',
    userId,
    onInsert: (row) => setShares(prev => [...prev, row]),
    onUpdate: (row) => setShares(prev => prev.map(s => s.id === row.id ? row : s)),
    onDelete: (id) => setShares(prev => prev.filter(s => s.id !== id)),
  })

  const currentWeekData = weeks[currentWeek - 1] || weeks[0]
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekData.startDate)
    date.setDate(date.getDate() + i)
    return date
  })

  const getSharesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return shares.filter(s => s.share_date === dateStr)
  }

  const getClientColor = (clientId: string) => {
    const index = clients.findIndex(c => c.id === clientId)
    return COLORS[index % COLORS.length]
  }

  const getShareStatusColor = (isShared: boolean) => {
    return isShared ? '#22C55E' : '#F59E0B' // Paylaşıldı=yeşil, Paylaşılmadı=sarı
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return '#888888'
      case 'ready':
        return '#F59E0B'
      case 'published':
        return '#22C55E'
      case 'cancelled':
        return '#EF4444'
      default:
        return '#888888'
    }
  }

  const openAddModal = (date: Date) => {
    setFormData({
      clientId: '',
      title: '',
      platform: 'instagram',
      status: 'planned',
      isShared: false,
    })
    setShareModal({ isOpen: true, date: format(date, 'yyyy-MM-dd') })
  }

  const openEditModal = (share: ContentShare) => {
    setFormData({
      clientId: share.client_id,
      title: share.title || '',
      platform: share.platform,
      status: share.status,
      isShared: share.is_shared,
    })
    setShareModal({ isOpen: true, share })
  }

  const saveShare = async () => {
    if (!formData.clientId) {
      toast.error('Müşteri seçiniz')
      return
    }

    const payload = {
      user_id: userId,
      client_id: formData.clientId,
      title: formData.title || null,
      platform: formData.platform,
      status: formData.status,
      is_shared: formData.isShared,
      share_date: shareModal.share?.share_date || shareModal.date,
    }

    if (shareModal.share) {
      const { error } = await supabase
        .from('content_shares')
        .update(payload)
        .eq('id', shareModal.share.id)

      if (error) {
        toast.error('Güncellenemedi')
        return
      }
      toast.success('Güncellendi')
    } else {
      const { error } = await supabase
        .from('content_shares')
        .insert(payload)

      if (error) {
        toast.error('Eklenemedi')
        return
      }
      toast.success('Eklendi')
    }

    setShareModal({ isOpen: false })
  }

  const deleteShare = async (id: string) => {
    if (!confirm('Sil?')) return
    const { error } = await supabase.from('content_shares').delete().eq('id', id)
    if (error) {
      toast.error('Silinemedi')
      return
    }
    toast.success('Silindi')
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', padding: '24px 0' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingLeft: 24, paddingRight: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Paylaşım Takvimi
          </h1>
        </div>

        {/* Week Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
          gap: 16,
        }}>
          <button
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek === 1}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              cursor: currentWeek === 1 ? 'not-allowed' : 'pointer',
              opacity: currentWeek === 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{
            textAlign: 'center',
            flex: 1,
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
              Hafta {currentWeek}
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
              {format(currentWeekData.startDate, 'd MMM', { locale: tr })} - {format(currentWeekData.endDate, 'd MMM yyyy', { locale: tr })}
            </p>
          </div>

          <button
            onClick={() => setCurrentWeek(Math.min(53, currentWeek + 1))}
            disabled={currentWeek === 53}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              cursor: currentWeek === 53 ? 'not-allowed' : 'pointer',
              opacity: currentWeek === 53 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 12,
        }}>
          {weekDays.map((date) => {
            const dayShares = getSharesForDay(date)
            const dayName = format(date, 'EEEE', { locale: tr })
            const dayNum = format(date, 'd')

            return (
              <div
                key={format(date, 'yyyy-MM-dd')}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Day Header */}
                <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'capitalize', marginBottom: 2 }}>
                    {dayName}
                  </p>
                  <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>
                    {dayNum}
                  </p>
                </div>

                {/* Shares */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {dayShares.map((share) => {
                    const client = clients.find(c => c.id === share.client_id)
                    return (
                      <div
                        key={share.id}
                        onClick={() => openEditModal(share)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Status Badge - Full Opacity */}
                        <div style={{
                          display: 'inline-block',
                          backgroundColor: getShareStatusColor(share.is_shared),
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          marginBottom: 8,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                          textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                          letterSpacing: '0.3px',
                          position: 'relative',
                          zIndex: 2,
                        }}>
                          {share.is_shared ? '✓ Paylaşıldı' : '⏳ Planlandı'}
                        </div>

                        {/* Background Layer - Transparent Only */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: getClientColor(share.client_id),
                            opacity: share.is_shared ? 0.25 : 0.12,
                            borderLeft: `3px solid ${getClientColor(share.client_id)}`,
                            borderRadius: 6,
                            transition: 'all 0.2s ease',
                            zIndex: 0,
                            pointerEvents: 'none',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = share.is_shared ? '0.35' : '0.2'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = share.is_shared ? '0.25' : '0.12'
                          }}
                        />

                        {/* Content Layer - Full Opacity */}
                        <div style={{ position: 'relative', zIndex: 1, padding: '8px', paddingTop: '32px' }}>
                          <p style={{
                            color: '#111827',
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: share.status === 'cancelled' ? 'line-through' : 'none',
                            margin: 0,
                          }}>
                            {client?.name}
                          </p>
                          <p style={{
                            color: '#374151',
                            fontSize: 11,
                            fontWeight: 600,
                            margin: '4px 0 0 0',
                          }}>
                            {share.platform} • {share.status}
                          </p>
                          {share.title && (
                            <p style={{
                              color: '#374151',
                              fontSize: 10,
                              fontWeight: 600,
                              margin: '4px 0 0 0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {share.title}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add Button */}
                <button
                  onClick={() => openAddModal(date)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px dashed var(--border)',
                    borderRadius: 6,
                    padding: 8,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                  }}
                >
                  <Plus size={14} />
                  Ekle
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {shareModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>
                {shareModal.share ? 'Düzenle' : 'Yeni Paylaşım'}
              </h2>
              <button
                onClick={() => setShareModal({ isOpen: false })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Client Select */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Müşteri
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData(p => ({ ...p, clientId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Seç</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Başlık/Not
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="Örn. Göğüs workout tüyoları"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Platform */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Platform
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['instagram', 'youtube'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setFormData(pr => ({ ...pr, platform: p }))}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        backgroundColor: formData.platform === p ? 'var(--accent)' : 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: formData.platform === p ? '#fff' : 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Durum
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as any }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="planned">Planlandı</option>
                  <option value="ready">Hazır</option>
                  <option value="published">Yayınlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>

              {/* Is Shared Toggle */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Durum
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setFormData(p => ({ ...p, isShared: true }))}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: formData.isShared ? '#22C55E' : 'var(--bg-card)',
                      border: `1px solid ${formData.isShared ? '#22C55E' : 'var(--border)'}`,
                      borderRadius: 6,
                      color: formData.isShared ? '#fff' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    ✓ Paylaşıldı
                  </button>
                  <button
                    onClick={() => setFormData(p => ({ ...p, isShared: false }))}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: !formData.isShared ? '#F59E0B' : 'var(--bg-card)',
                      border: `1px solid ${!formData.isShared ? '#F59E0B' : 'var(--border)'}`,
                      borderRadius: 6,
                      color: !formData.isShared ? '#fff' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    ⏳ Planlandı
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Tarih
                </label>
                <input
                  type="date"
                  value={shareModal.date || shareModal.share?.share_date || ''}
                  onChange={(e) => {
                    if (shareModal.share) {
                      setShareModal(p => ({ ...p, share: { ...p.share!, share_date: e.target.value } as any }))
                    } else {
                      setShareModal(p => ({ ...p, date: e.target.value }))
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              {shareModal.share && (
                <button
                  onClick={() => {
                    deleteShare(shareModal.share!.id)
                    setShareModal({ isOpen: false })
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#EF4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = '1'
                  }}
                >
                  Sil
                </button>
              )}
              <button
                onClick={() => setShareModal({ isOpen: false })}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                İptal
              </button>
              <button
                onClick={saveShare}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.9'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1'
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
