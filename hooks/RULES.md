# İş Akışı Uygulaması — Geliştirme Kuralları

Bu dosya Claude Code ve geliştirici için kalıcı kuralları tanımlar.
Hook sistemi bu kurallara göre kontrol yapar.

---

## 1. Next.js 16 Kuralları

### ❌ Yasak
```ts
// YANLIŞ — Next.js 16'da middleware.ts çalışmaz
// src/middleware.ts
export async function middleware(req) { ... }
```

### ✅ Doğru
```ts
// DOĞRU — src/proxy.ts kullan
export async function proxy(req) { ... }

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*) '],
}
```

### Server Sayfalarda force-dynamic Zorunlu
```ts
// Supabase kullanan HER server component/page
export const dynamic = 'force-dynamic'  // ← EN ÜST SATIR

import { createClient } from '@/lib/supabase/server'
```

### Client Component Layout Kuralı
- `'use client'` olan sayfalarda `dynamic` export çalışmaz
- Bunun yerine üst `layout.tsx`'e ekle:
```ts
// src/app/(app)/projeler/layout.tsx
export const dynamic = 'force-dynamic'
export default function Layout({ children }) { return <>{children}</> }
```

---

## 2. Supabase Kuralları

### Server Component (SSR)
```ts
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()  // ← await gerekli
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  // ...
}
```

### Client Component
```ts
'use client'
import { createClient } from '@/lib/supabase/client'

export default function ClientComp() {
  const supabase = createClient()  // ← await YOK
  // ...
}
```

### RLS Zorunlu
- Tüm tablolarda `user_id UUID` alanı + RLS policy olmalı
- Her sorguya `.eq('user_id', user.id)` eklenmeli
- `supabase-schema.sql` dosyasında tüm RLS policy'leri mevcut

### Güvenli Sorgulama Örneği
```ts
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', user.id)  // ← HER ZAMAN ekle
  .order('created_at', { ascending: false })
```

---

## 3. TypeScript Kuralları

### Tip Tanımlama
- Tüm tipler `src/types/index.ts`'de tanımlı
- Supabase response'larında tip assertion kullan: `as Task`
- `any` kullanma — `unknown` veya proper tip kullan

### Enum Tipleri
```ts
// types/index.ts'deki tipleri kullan
import type { Task, Priority, TaskStatus } from '@/types'

// State için tip ver
type FormState = {
  priority: 'low' | 'medium' | 'high' | 'urgent'  // union type
  status: TaskStatus  // veya import edilen tip
}
const [form, setForm] = useState<FormState>(defaultForm)
```

---

## 4. Bileşen Kuralları

### Dosya Yapısı
```
src/
  app/
    (app)/          → Route group (layout dahil)
      layout.tsx    → Sidebar + BottomNav
      page.tsx      → Dashboard (server)
      gorevler/
        page.tsx    → Server wrapper
    auth/
      login/
        page.tsx    → Client component
      layout.tsx    → force-dynamic layout (zorunlu!)
  components/
    layout/         → Sidebar, BottomNav
    dashboard/      → DashboardClient
    gorevler/       → GorevlerClient, GorevModal
    notlar/         → NotlarClient, NotModal
    alacaklar/      → AlacaklarClient
    takvim/         → TakvimClient
    projeler/       → ProjeDetayClient
  lib/
    supabase/
      client.ts     → Browser client
      server.ts     → Server client (await gerekli)
      middleware.ts → updateSession helper
  types/
    index.ts        → Tüm interface tanımları
  proxy.ts          → Auth middleware
```

### Server/Client Ayrımı
| Dosya | Tip | Notlar |
|-------|-----|--------|
| `app/**/page.tsx` | Server (default) | `force-dynamic` ekle |
| `components/**/*Client.tsx` | `'use client'` | Interaktif logic |
| `components/**/*Modal.tsx` | `'use client'` | Form + state |

### Stil Kuralları
- CSS Variables kullan: `var(--bg-card)`, `var(--accent)`, vb.
- Inline style tercih et (Tailwind class değil) — tutarlılık için
- Animasyonlar: `transition: all 0.2s ease`
- Mobil: iOS scroll için `className="scroll-ios"` ekle

---

## 5. Git Kuralları

### ❌ Commit Edilmemeli
```
.env.local
.env.production
.env.test
hooks/credentials.env
.next/
node_modules/
```

### ✅ .gitignore Zorunlu İçerik
```
.env*.local
.env.production
hooks/credentials.env
.next/
node_modules/
*.bak
```

### Commit Mesajı Formatı
```
feat: Görev modal formuna tekrarlayan görev desteği eklendi
fix: Takvim sayfasında timezone hatası düzeltildi
chore: Dependencies güncellendi
refactor: AlacaklarClient bileşeni parçalandı
```

### Branch Stratejisi
- `main` → Production
- `feat/özellik-adı` → Yeni özellikler
- `fix/hata-adı` → Bug fix'ler

---

## 6. Performans Kuralları

- Dashboard'da veriler `Promise.all` ile paralel yüklenmeli
- Ağır listeler için `useMemo` kullan (GorevlerClient örneği)
- Supabase sorgularında gereksiz kolonları `select('*')` yerine belirt
- Fotoğraf/ikon için `next/image` kullan

---

## 7. Hata Yönetimi Kuralları

```ts
// Her Supabase işleminden sonra
const { data, error } = await supabase.from('tasks').insert(...)
if (error) {
  toast.error('İşlem başarısız')  // Türkçe mesaj
  return
}
toast.success('Görev eklendi')  // Başarı bildirimi
```

- Toast kullan: `react-hot-toast`
- Silme işlemlerinde `confirm()` modalı istenmeli
- Loading state her formda gösterilmeli

---

## 8. Deployment Kuralları

### Vercel Ortam Değişkenleri
```
NEXT_PUBLIC_SUPABASE_URL     → Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase anon/public key
```

### Pre-Deploy Checklist
- [ ] `npm run build` hatasız çalışıyor
- [ ] `npx tsc --noEmit` hata yok
- [ ] `.env.local` Vercel'e eklenmiş (ortam değişkeni olarak)
- [ ] Supabase RLS aktif
- [ ] `supabase-schema.sql` production DB'ye uygulanmış

---

## 9. Bilinen Sorunlar & Çözümler

| Sorun | Çözüm |
|-------|-------|
| `middleware.ts` deprecated uyarısı | `proxy.ts` kullan, export adı `proxy` olmalı |
| Prerender hatası (Invalid supabaseUrl) | `force-dynamic` ekle veya layout kullan |
| TypeScript: `Type 'X' not assignable to 'Y'` | `const defaultForm: FormType = {...}` ile tip ver |
| `kanban_column_id` tip hatası | `src/types/index.ts` Task interface'ine ekle |
| Client component'te `dynamic` export | Üst layout'a taşı |
| Supabase server client'ta `await` unutuldu | `const supabase = await createClient()` |

---

*Bu dosya `hooks/check-project.sh` tarafından referans olarak kullanılır.*
*Son güncelleme: 2026-03-09*
