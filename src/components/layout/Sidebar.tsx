'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  FileText,
  Wallet,
  LogOut,
  BarChart3,
  TrendingDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/gorevler', icon: CheckSquare, label: 'Görevler' },
  { href: '/projeler', icon: FolderKanban, label: 'Projeler' },
  { href: '/notlar', icon: FileText, label: 'Notlar' },
  { href: '/alacaklar', icon: Wallet, label: 'Alacaklar' },
  { href: '/giderler', icon: TrendingDown, label: 'Giderler' },
  { href: '/raporlar', icon: BarChart3, label: 'Raporlar' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '0 12px 32px' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
          İş Akışı
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon
                size={18}
                color={isActive ? 'var(--accent)' : 'var(--text-secondary)'}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 8,
          fontSize: 14,
          color: 'var(--text-secondary)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'
            ; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        <LogOut size={18} />
        Çıkış Yap
      </button>
    </aside>
  )
}
