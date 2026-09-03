#!/bin/bash
# Regenerates the extension icons from a single vector source.
# Simple neutral mark: three white "field" bars on a dark grey rounded square.
# Requires ImageMagick (`brew install imagemagick`).

set -e
cd "$(dirname "$0")/.."
mkdir -p icons

cat > /tmp/icon.svg <<'EOF'
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="26" fill="#3C4043"/>
  <rect x="32" y="40" width="64" height="11" rx="5.5" fill="#FFFFFF"/>
  <rect x="32" y="62" width="64" height="11" rx="5.5" fill="#FFFFFF"/>
  <rect x="32" y="84" width="40" height="11" rx="5.5" fill="#FFFFFF"/>
</svg>
EOF

MAGICK=magick
command -v magick >/dev/null 2>&1 || MAGICK=convert
if ! command -v "$MAGICK" >/dev/null 2>&1; then
  echo "ImageMagick not found. Run: brew install imagemagick" >&2
  exit 1
fi

for size in 16 48 128; do
  "$MAGICK" -background none -density 384 /tmp/icon.svg -resize ${size}x${size} icons/icon-${size}.png
done

echo "Icons regenerated."
