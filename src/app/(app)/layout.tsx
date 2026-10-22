import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block" style={{ width: 236, flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'clamp(20px, 3vw, 36px) clamp(16px, 3vw, 36px)',
            paddingBottom: '80px', // Mobile bottom nav için
            maxWidth: 1240,
          }}
          className="md:pb-6"
        >
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
