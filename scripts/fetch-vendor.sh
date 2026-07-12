#!/usr/bin/env bash
# =============================================================================
# VIS · fetch-vendor
# Downloads the browser libraries into assets/vendor/ so VIS runs fully offline
# (no external CDN calls). Run this ONCE on a machine that has internet access,
# then commit the assets/vendor/ folder and deploy anywhere — including internal
# / air-gapped networks.
#
#   bash scripts/fetch-vendor.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="public/assets/vendor"
mkdir -p "$DEST"

fetch () {
  echo "  -> $DEST/$2"
  curl -fsSL "$1" -o "$DEST/$2"
}

echo "Downloading VIS libraries into $DEST/ ..."
fetch "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"          "echarts.min.js"
fetch "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js" "html-to-image.js"
fetch "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"           "jspdf.umd.min.js"
fetch "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"     "pptxgen.bundle.js"

echo ""
echo "Done. VIS will now load these locally (no external CDN needed)."
echo "Commit the public/assets/vendor/ folder to ship an offline / internal build."
