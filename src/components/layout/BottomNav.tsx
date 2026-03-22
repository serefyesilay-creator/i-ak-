'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  FileText,
  Wallet,
  BarChart3,
  TrendingDown,
  Landmark,
  Calendar,
} from 'lucide-react'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { href: '/gorevler', icon: CheckSquare, label: 'Görevler' },
  { href: '/projeler', icon: FolderKanban, label: 'Projeler' },
  { href: '/paylasim', icon: Calendar, label: 'Paylaşım' },
  { href: '/notlar', icon: FileText, label: 'Notlar' },
  { href: '/alacaklar', icon: Wallet, label: 'Alacaklar' },
  { href: '/giderler', icon: TrendingDown, label: 'Giderler' },
  { href: '/varliklar', icon: Landmark, label: 'Varlıklar' },
  { href: '/raporlar', icon: BarChart3, label: 'Raporlar' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 0 env(safe-area-inset-bottom, 8px)',
        zIndex: 50,
      }}
    >
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '4px 8px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              transition: 'color 0.15s ease',
            }}
          >
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
