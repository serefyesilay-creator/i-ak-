'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Wallet,
  LogOut,
  BarChart3,
  TrendingDown,
  Landmark,
  Calendar,
  Timer,
  Play,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRunningTimer, formatClock } from '@/hooks/useRunningTimer'

const navGroups = [
  {
    label: 'Çalışma',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Bugün' },
      { href: '/gorevler', icon: CheckSquare, label: 'Görevler' },
      { href: '/projeler', icon: FolderKanban, label: 'Projeler' },
      { href: '/paylasim', icon: Calendar, label: 'Paylaşım' },
      { href: '/zaman-takibi', icon: Timer, label: 'Zaman Takibi' },
    ],
  },
  {
    label: 'Para',
    items: [
      { href: '/alacaklar', icon: Wallet, label: 'Alacaklar' },
      { href: '/giderler', icon: TrendingDown, label: 'Giderler' },
      { href: '/varliklar', icon: Landmark, label: 'Varlıklar' },
      { href: '/raporlar', icon: BarChart3, label: 'Raporlar' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { running, seconds } = useRunningTimer()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      style={{
        width: 236,
        minHeight: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 14px 16px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ padding: '0 12px 6px', display: 'flex', alignItems: 'baseline', gap: 3, textDecoration: 'none' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, letterSpacing: '-0.035em', color: 'var(--text-primary)' }}>
          İş Akışı
        </span>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: 'var(--mark)' }} />
      </Link>

      {/* Navigation */}
      <nav style={{ flex: 1 }} aria-label="Ana menü">
        {navGroups.map(group => (
          <div key={group.label}>
            <div className="nav-group">{group.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map(({ href, icon: Icon, label }) => {
                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className="nav-link"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Canlı sayaç */}
      <Link href="/zaman-takibi" className={`timer-chip ${running ? 'is-live' : ''}`}>
        {running ? (
          <>
            <div className="timer-chip-top"><span className="live-dot" aria-hidden /> Sayaç çalışıyor</div>
            <div className="timer-chip-client">{running.clientName}</div>
            <div className="timer-chip-clock">{formatClock(seconds)}</div>
          </>
        ) : (
          <div className="timer-chip-top" style={{ justifyContent: 'space-between' }}>
            <span>Sayaç kapalı</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-soft)', fontWeight: 600 }}>
              <Play size={12} /> Başlat
            </span>
          </div>
        )}
      </Link>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="nav-link nav-logout"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
      >
        <LogOut size={18} />
        Çıkış Yap
      </button>
    </aside>
  )
}
