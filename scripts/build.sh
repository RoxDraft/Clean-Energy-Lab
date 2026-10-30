#!/usr/bin/env bash
# ประกอบหน้าเว็บสำหรับ GitHub Pages ลงโฟลเดอร์ _site
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir -p _site/data
{
  echo '<!doctype html><html lang="th"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<style>body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat site/index.html
  echo '</body></html>'
} > _site/index.html
cp data/*.json _site/data/
