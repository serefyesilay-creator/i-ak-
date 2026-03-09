#!/usr/bin/env zsh
# ============================================================
# install.sh — Git hook'larını kur
# Kullanım: ./hooks/install.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GIT_HOOKS_DIR="$PROJECT_DIR/.git/hooks"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}Git Hook Kurulum Sistemi${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Git repo kontrolü
if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo -e "${YELLOW}⚠ .git klasörü bulunamadı.${NC}"
  echo -e "${CYAN}→ Git repo oluşturuluyor...${NC}"
  cd "$PROJECT_DIR"
  git init
  echo -e "${GREEN}✓ Git repo oluşturuldu${NC}"
fi

mkdir -p "$GIT_HOOKS_DIR"

# Hook'ları kur
HOOKS=("pre-commit" "pre-push")

for hook in "${HOOKS[@]}"; do
  src="$SCRIPT_DIR/$hook"
  dst="$GIT_HOOKS_DIR/$hook"

  if [[ ! -f "$src" ]]; then
    echo -e "${RED}✗ $hook scripti bulunamadı: $src${NC}"
    continue
  fi

  # Executable yap
  chmod +x "$src"

  # Sembolik link oluştur (var olanı sil)
  if [[ -f "$dst" || -L "$dst" ]]; then
    rm "$dst"
  fi

  ln -sf "$src" "$dst"
  chmod +x "$dst"
  echo -e "${GREEN}✓ $hook kuruldu → $dst${NC}"
done

# Tüm hook scriptleri executable yap
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

echo ""
echo -e "${BOLD}Kurulum tamamlandı!${NC}"
echo ""

# credentials.env kontrolü
if grep -q "your_supabase_url_here" "$SCRIPT_DIR/credentials.env" 2>/dev/null; then
  echo -e "${YELLOW}⚠ Önemli: hooks/credentials.env dosyasını doldurun!${NC}"
  echo -e "  ${CYAN}Supabase URL ve key'i girin:${NC}"
  echo -e "  ${CYAN}→ $SCRIPT_DIR/credentials.env${NC}"
  echo ""
fi

echo -e "Kullanılabilir komutlar:"
echo -e "  ${CYAN}./hooks/check-project.sh${NC}          — Hızlı kontrol"
echo -e "  ${CYAN}./hooks/check-project.sh --full${NC}   — Build dahil tam kontrol"
echo -e "  ${CYAN}./hooks/check-project.sh --watch${NC}  — İzleme modu"
echo -e "  ${CYAN}./hooks/check-project.sh --fast${NC}   — Sadece TS + ESLint"
echo ""
