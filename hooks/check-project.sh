#!/usr/bin/env zsh
# ============================================================
# check-project.sh — Proje Bütünlük & Uyumluluk Kontrolü
# Kullanım: ./hooks/check-project.sh [--watch]
# ============================================================

set -e

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$HOOKS_DIR/.." && pwd)"
CREDS_FILE="$HOOKS_DIR/credentials.env"

# ── Renkler ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"
INFO="${CYAN}→${NC}"

ERRORS=0
WARNINGS=0

pass()  { echo -e "  $PASS $1" }
fail()  { echo -e "  $FAIL ${RED}$1${NC}"; ERRORS=$((ERRORS+1)) }
warn()  { echo -e "  $WARN ${YELLOW}$1${NC}"; WARNINGS=$((WARNINGS+1)) }
info()  { echo -e "  $INFO $1" }
header(){ echo -e "\n${BOLD}${CYAN}▶ $1${NC}" }

# ── Credentials yükle ───────────────────────────────────────
load_credentials() {
  if [[ -f "$CREDS_FILE" ]]; then
    # Placeholder olmayan satırları yükle
    while IFS='=' read -r key value; do
      [[ "$key" =~ ^#.*$ ]] && continue
      [[ -z "$key" ]] && continue
      [[ "$value" == *"your_"* ]] && continue
      export "$key=$value"
    done < "$CREDS_FILE"

    if [[ -n "$NEXT_PUBLIC_SUPABASE_URL" && "$NEXT_PUBLIC_SUPABASE_URL" != *"your_"* ]]; then
      info "Credentials yüklendi: $CREDS_FILE"
      # .env.local'ı geçici olarak credentials ile güncelle
      cp "$PROJECT_DIR/.env.local" "$PROJECT_DIR/.env.local.bak" 2>/dev/null || true
      cat > "$PROJECT_DIR/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
EOF
      CREDS_LOADED=1
    fi
  fi
}

restore_env() {
  if [[ "$CREDS_LOADED" == "1" && -f "$PROJECT_DIR/.env.local.bak" ]]; then
    mv "$PROJECT_DIR/.env.local.bak" "$PROJECT_DIR/.env.local"
  fi
}
trap restore_env EXIT

# ── Node.js PATH ─────────────────────────────────────────────
setup_path() {
  if ! command -v node &>/dev/null; then
    export PATH="/Users/seref/pinokio/bin/miniconda/bin:$PATH"
  fi
  if ! command -v node &>/dev/null; then
    fail "Node.js bulunamadı!"
    exit 1
  fi
}

# ── 1. Ortam Kontrolü ────────────────────────────────────────
check_environment() {
  header "Ortam Kontrolü"

  node_ver=$(node --version 2>/dev/null)
  if [[ -n "$node_ver" ]]; then
    pass "Node.js: $node_ver"
  else
    fail "Node.js bulunamadı"
  fi

  npm_ver=$(npm --version 2>/dev/null)
  [[ -n "$npm_ver" ]] && pass "npm: $npm_ver" || warn "npm bulunamadı"

  if [[ -f "$PROJECT_DIR/.env.local" ]]; then
    pass ".env.local mevcut"
    if grep -q "your_supabase_url_here" "$PROJECT_DIR/.env.local"; then
      warn "Supabase URL henüz girilmemiş (.env.local)"
    else
      pass "Supabase URL tanımlı"
    fi
  else
    fail ".env.local dosyası eksik"
  fi
}

# ── 2. Bağımlılık Kontrolü ──────────────────────────────────
check_dependencies() {
  header "Bağımlılık Kontrolü"

  if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
    fail "node_modules eksik — 'npm install' çalıştırın"
    return
  fi
  pass "node_modules mevcut"

  # Kritik paketler
  local critical_pkgs=(
    "next"
    "@supabase/supabase-js"
    "@supabase/ssr"
    "@dnd-kit/core"
    "date-fns"
    "lucide-react"
    "react-hot-toast"
    "zustand"
  )

  for pkg in "${critical_pkgs[@]}"; do
    if [[ -d "$PROJECT_DIR/node_modules/$pkg" ]]; then
      pass "$pkg"
    else
      fail "$pkg eksik — npm install çalıştırın"
    fi
  done

  # package.json kontrolü
  if [[ -f "$PROJECT_DIR/package.json" ]]; then
    pass "package.json mevcut"
  else
    fail "package.json eksik!"
  fi
}

# ── 3. Next.js 16 Uyumluluk Kontrolü ────────────────────────
check_nextjs_compat() {
  header "Next.js 16 Uyumluluk Kontrolü"

  # middleware.ts → proxy.ts kontrolü
  if [[ -f "$PROJECT_DIR/src/middleware.ts" ]]; then
    fail "src/middleware.ts bulundu! Next.js 16'da proxy.ts kullanılmalı"
    info "  → 'mv src/middleware.ts src/proxy.ts' ve export'u 'middleware' → 'proxy' olarak değiştirin"
  else
    pass "proxy.ts convention kullanılıyor"
  fi

  if [[ -f "$PROJECT_DIR/src/proxy.ts" ]]; then
    if grep -q "export async function proxy" "$PROJECT_DIR/src/proxy.ts"; then
      pass "proxy.ts — export adı doğru"
    else
      fail "proxy.ts — export fonksiyon adı 'proxy' olmalı (şu an farklı)"
    fi
  fi

  # Sunucu sayfalarında force-dynamic kontrolü
  info "Server sayfalarında 'force-dynamic' aranıyor..."
  local missing_dynamic=()
  while IFS= read -r -d '' file; do
    # Client component'leri atla
    if grep -q "^'use client'" "$file"; then
      # Layout dosyalarında dynamic gerekiyor
      if [[ "$file" == *"layout.tsx" ]] && ! grep -q "force-dynamic" "$file"; then
        # Supabase kullanan layout'lar için
        if grep -q "supabase" "$file" 2>/dev/null; then
          missing_dynamic+=("$file")
        fi
      fi
      continue
    fi
    # Server component'lerde supabase kullanılıyorsa force-dynamic gerekli
    if grep -q "createClient\|supabase" "$file" 2>/dev/null; then
      if ! grep -q "force-dynamic" "$file"; then
        missing_dynamic+=("$file")
      fi
    fi
  done < <(find "$PROJECT_DIR/src/app" -name "*.tsx" -print0 2>/dev/null)

  if [[ ${#missing_dynamic[@]} -eq 0 ]]; then
    pass "Tüm server sayfaları 'force-dynamic' export ediyor"
  else
    for f in "${missing_dynamic[@]}"; do
      rel="${f#$PROJECT_DIR/}"
      warn "force-dynamic eksik: $rel"
    done
  fi

  # App Router yapısı
  if [[ -d "$PROJECT_DIR/src/app/(app)" ]]; then
    pass "Route group (app) mevcut"
  else
    warn "Route group (app) bulunamadı — sayfa yapısı beklenen formatta değil"
  fi
}

# ── 4. TypeScript Kontrolü ──────────────────────────────────
check_typescript() {
  header "TypeScript Kontrolü"

  if [[ ! -f "$PROJECT_DIR/tsconfig.json" ]]; then
    fail "tsconfig.json eksik"
    return
  fi
  pass "tsconfig.json mevcut"

  info "TypeScript derleme kontrolü çalışıyor..."
  cd "$PROJECT_DIR"

  if npx tsc --noEmit 2>/tmp/tsc_output; then
    pass "TypeScript — hata yok"
  else
    fail "TypeScript hataları bulundu:"
    cat /tmp/tsc_output | while IFS= read -r line; do
      echo -e "    ${RED}$line${NC}"
    done
  fi
}

# ── 5. ESLint Kontrolü ──────────────────────────────────────
check_eslint() {
  header "ESLint Kontrolü"

  cd "$PROJECT_DIR"
  if npx next lint --quiet 2>/tmp/eslint_output; then
    pass "ESLint — hata yok"
  else
    local exit_code=$?
    if grep -q "warning" /tmp/eslint_output; then
      warn "ESLint uyarıları var (hata değil)"
    else
      fail "ESLint hataları bulundu:"
      cat /tmp/eslint_output | while IFS= read -r line; do
        echo -e "    ${RED}$line${NC}"
      done
    fi
  fi
}

# ── 6. Build Kontrolü ───────────────────────────────────────
check_build() {
  header "Build Kontrolü"

  info "Production build çalışıyor... (bu biraz sürebilir)"
  cd "$PROJECT_DIR"

  if npm run build 2>/tmp/build_output; then
    pass "Build başarılı"
    # Rota sayısını göster
    route_count=$(grep -c "ƒ\|○" /tmp/build_output 2>/dev/null || echo "?")
    info "  Toplam rota: yaklaşık $route_count"
  else
    fail "Build başarısız!"
    # Sadece hata satırlarını göster
    grep -E "error|Error|Failed" /tmp/build_output | while IFS= read -r line; do
      echo -e "    ${RED}$line${NC}"
    done
  fi
}

# ── 7. Dosya Yapısı Kontrolü ────────────────────────────────
check_file_structure() {
  header "Dosya Yapısı Kontrolü"

  local required_files=(
    "src/app/(app)/page.tsx"
    "src/app/(app)/gorevler/page.tsx"
    "src/app/(app)/projeler/page.tsx"
    "src/app/(app)/notlar/page.tsx"
    "src/app/(app)/alacaklar/page.tsx"
    "src/app/(app)/takvim/page.tsx"
    "src/app/auth/login/page.tsx"
    "src/app/layout.tsx"
    "src/lib/supabase/client.ts"
    "src/lib/supabase/server.ts"
    "src/types/index.ts"
    "src/proxy.ts"
    "public/manifest.json"
    ".env.local"
    "supabase-schema.sql"
  )

  for f in "${required_files[@]}"; do
    if [[ -f "$PROJECT_DIR/$f" ]]; then
      pass "$f"
    else
      fail "Eksik: $f"
    fi
  done
}

# ── 8. Supabase Bağlantı Testi ──────────────────────────────
check_supabase_connection() {
  header "Supabase Bağlantı Testi"

  if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" || "$NEXT_PUBLIC_SUPABASE_URL" == *"your_"* ]]; then
    warn "Supabase URL tanımlı değil — bağlantı testi atlandı"
    info "  → hooks/credentials.env dosyasını doldurun"
    return
  fi

  # Basit HTTP sağlık kontrolü
  http_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" 2>/dev/null || echo "000")

  case "$http_status" in
    200|401) pass "Supabase erişilebilir (HTTP $http_status)" ;;
    000)     fail "Supabase'e bağlanılamadı — internet bağlantısını kontrol edin" ;;
    *)       warn "Supabase beklenmedik yanıt: HTTP $http_status" ;;
  esac
}

# ── 9. Güvenlik Kontrolü ────────────────────────────────────
check_security() {
  header "Güvenlik Kontrolü"

  # .env dosyalarının git'e eklenmediğini kontrol et
  if [[ -f "$PROJECT_DIR/.gitignore" ]]; then
    if grep -q "\.env" "$PROJECT_DIR/.gitignore"; then
      pass ".env dosyaları .gitignore'da"
    else
      fail ".env dosyaları .gitignore'a eklenmeli!"
    fi
    if grep -q "credentials\.env" "$PROJECT_DIR/.gitignore" || grep -q "hooks/credentials" "$PROJECT_DIR/.gitignore"; then
      pass "credentials.env .gitignore'da"
    else
      warn "hooks/credentials.env .gitignore'a eklenmeli!"
    fi
  else
    warn ".gitignore dosyası bulunamadı"
  fi

  # Hardcoded secret kontrolü (basit)
  info "Kaynak kodda hardcoded secret aranıyor..."
  if grep -r "supabase\.co" "$PROJECT_DIR/src" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".env" | grep -q "https://"; then
    fail "Kaynak kodda hardcoded Supabase URL bulundu!"
  else
    pass "Hardcoded secret yok"
  fi
}

# ── Özet ────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✅  Tüm kontroller geçti!${NC}"
  elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}${BOLD}⚠   $WARNINGS uyarı — $ERRORS hata${NC}"
  else
    echo -e "${RED}${BOLD}❌  $ERRORS hata, $WARNINGS uyarı${NC}"
  fi
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo ""

  [[ $ERRORS -gt 0 ]] && exit 1 || exit 0
}

# ── Watch Modu ──────────────────────────────────────────────
watch_mode() {
  echo -e "${CYAN}${BOLD}👁  Watch modu — dosya değişikliklerini izliyor...${NC}"
  echo -e "${CYAN}   Ctrl+C ile çıkın${NC}\n"

  while true; do
    # TypeScript ve ESLint hızlı kontrol
    echo -e "\n${BOLD}$(date '+%H:%M:%S') — Hızlı kontrol...${NC}"
    cd "$PROJECT_DIR"

    ts_ok=true
    lint_ok=true

    npx tsc --noEmit 2>/tmp/watch_ts && ts_ok=true || ts_ok=false

    if $ts_ok; then
      echo -e "  $PASS TypeScript OK"
    else
      echo -e "  $FAIL TypeScript hataları:"
      cat /tmp/watch_ts | while IFS= read -r line; do
        echo -e "    ${RED}$line${NC}"
      done
    fi

    sleep 10
  done
}

# ── Ana Akış ────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║  İş Akışı — Proje Kontrol Sistemi   ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${NC}"
  echo -e "  Proje: $PROJECT_DIR"
  echo -e "  Tarih: $(date '+%d.%m.%Y %H:%M')"

  setup_path
  load_credentials

  if [[ "$1" == "--watch" ]]; then
    check_environment
    check_dependencies
    watch_mode
    exit 0
  fi

  if [[ "$1" == "--fast" ]]; then
    check_environment
    check_dependencies
    check_nextjs_compat
    check_typescript
    check_eslint
    print_summary
  fi

  # Full kontrol (default)
  check_environment
  check_dependencies
  check_nextjs_compat
  check_file_structure
  check_typescript
  check_eslint
  check_supabase_connection
  check_security

  if [[ "$1" == "--full" || "$1" == "--build" ]]; then
    check_build
  fi

  print_summary
}

main "$@"
