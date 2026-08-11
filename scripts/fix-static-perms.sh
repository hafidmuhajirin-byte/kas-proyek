#!/bin/bash
# Agar nginx bisa menyajikan /_next/static, /icons, login-bg (www-data).
set -euo pipefail
ROOT="${1:-/var/www/kas-proyek}"
chmod 755 "$ROOT" "$ROOT/public" "$ROOT/.next" 2>/dev/null || true
chmod -R a+rX "$ROOT/public/icons" "$ROOT/.next/static" 2>/dev/null || true
chmod a+r "$ROOT/public"/login-bg.* "$ROOT/public/sw.js" 2>/dev/null || true
chmod 600 "$ROOT/.env" 2>/dev/null || true
echo "static perms ok"
