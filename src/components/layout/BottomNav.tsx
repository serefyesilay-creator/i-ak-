'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRunningTimer, formatClock } from '@/hooks/useRunningTimer'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Wallet,
  BarChart3,
  TrendingDown,
  Landmark,
  Calendar,
  Timer,
  MoreHorizontal,
  X,
} from 'lucide-react'

// Alt barda doğrudan görünenler — 4'ten fazla olmamalı, yoksa telefonda taşar.
const primaryItems = [
  { href: '/', icon: LayoutDashboard, label: 'Bugün' },
  { href: '/gorevler', icon: CheckSquare, label: 'Görevler' },
  { href: '/zaman-takibi', icon: Timer, label: 'Zaman' },
  { href: '/projeler', icon: FolderKanban, label: 'Projeler' },
]

// "Diğer" menüsünde açılanlar. Yeni sayfa eklerken buraya eklemek yeterli.
const moreItems = [
  { href: '/paylasim', icon: Calendar, label: 'Paylaşım' },
  { href: '/alacaklar', icon: Wallet, label: 'Alacaklar' },
  { href: '/giderler', icon: TrendingDown, label: 'Giderler' },
  { href: '/varliklar', icon: Landmark, label: 'Varlıklar' },
  { href: '/raporlar', icon: BarChart3, label: 'Raporlar' },
]

function isPathActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { running, seconds } = useRunningTimer()

  const moreActive = moreItems.some(item => isPathActive(pathname, item.href))

  const labelStyle: React.CSSProperties = {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* Çalışan sayaç: her sayfada görünür (sayaç sayfası hariç) */}
      {running && !pathname.startsWith('/zaman-takibi') && !moreOpen && (
        <Link href="/zaman-takibi" className="bnav-timer">
          <span className="live-dot" aria-hidden />
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{running.clientName}</span>
          <span className="clock">{formatClock(seconds)}</span>
        </Link>
      )}
      {/* "Diğer" açılır menüsü */}
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(8,9,12,0.6)',
              zIndex: 60,
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'var(--bg-surface)',
              borderTop: '1px solid var(--border)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '18px 16px calc(env(safe-area-inset-bottom, 8px) + 18px)',
              zIndex: 70,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Diğer
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Kapat"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {moreItems.map(({ href, icon: Icon, label }) => {
                const active = isPathActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '16px 8px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      backgroundColor: active ? 'var(--bg-raised)' : 'var(--bg-card)',
                      border: `1px solid ${active ? 'var(--mark)' : 'var(--border)'}`,
                    }}
                  >
                    <Icon size={22} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(24,25,31,0.92)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          padding: '8px 4px env(safe-area-inset-bottom, 8px)',
          backdropFilter: 'blur(12px)',
          zIndex: 50,
        }}
      >
        {primaryItems.map(({ href, icon: Icon, label }) => {
          const active = isPathActive(pathname, href)
          return (
            <Link key={href} href={href} className="bnav-item" aria-current={active ? 'page' : undefined}>
              <Icon size={20} />
              <span style={labelStyle}>{label}</span>
            </Link>
          )
        })}

        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Diğer sayfalar"
          className="bnav-item"
          aria-current={moreActive ? 'page' : undefined}
        >
          <MoreHorizontal size={20} />
          <span style={labelStyle}>Diğer</span>
        </button>
      </nav>
    </>
  )
}
