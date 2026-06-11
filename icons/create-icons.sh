#!/bin/bash
# Creates simple SVG icons for the extension

mkdir -p icons

# Create 16x16 icon
cat > /tmp/icon-16.svg << 'EOF'
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="#FF6D00"/>
  <text x="8" y="12" font-size="10" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">{}</text>
</svg>
EOF

# Create 48x48 icon
cat > /tmp/icon-48.svg << 'EOF'
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#FF6D00"/>
  <text x="24" y="36" font-size="28" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">{}</text>
</svg>
EOF

# Create 128x128 icon
cat > /tmp/icon-128.svg << 'EOF'
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#FF6D00"/>
  <text x="64" y="95" font-size="72" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">{}</text>
</svg>
EOF

# Convert SVG to PNG using ImageMagick if available
if command -v convert &> /dev/null; then
  convert /tmp/icon-16.svg -background none icons/icon-16.png
  convert /tmp/icon-48.svg -background none icons/icon-48.png
  convert /tmp/icon-128.svg -background none icons/icon-128.png
  echo "Icons created successfully!"
else
  echo "ImageMagick not found. Using SVG conversion..."
  # Fall back to using Chromium's built-in SVG support by creating PNG placeholders
  echo "Please install ImageMagick (brew install imagemagick) and run this script again"
fi
