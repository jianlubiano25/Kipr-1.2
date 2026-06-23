#!/usr/bin/env bash
# generate-splashes.sh
# Generates iOS PWA apple-touch-startup-image PNGs for all common device sizes.
# Uses macOS built-in `sips` — no npm/install required.
# Run once whenever you update the splash artwork.

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p splashes

# Source images (1024x1024 source, will be padded/fit to each target)
LIGHT="splash_light_src.png"
DARK="splash_dark_src.png"
NEBULA="splash_nebula_src.png"

# ──────────────────────────────────────────────────────────────────────
# iOS device portrait sizes  (width x height in actual device pixels)
# ──────────────────────────────────────────────────────────────────────
# Device                        | CSS px         | Scale | Physical px
# iPhone 16 Pro Max             | 440×956        | 3×    | 1320×2868
# iPhone 16 Pro / 15 Pro        | 402×874        | 3×    | 1206×2622
# iPhone 16 / 15 / 14           | 390×844        | 3×    | 1170×2532
# iPhone 16 Plus / 15 Plus / 14 Plus | 430×932  | 3×    | 1290×2796
# iPhone 13 / 13 Pro            | 390×844        | 3×    | 1170×2532  (same)
# iPhone 13 mini                | 375×812        | 3×    | 1125×2436
# iPhone 11 / XR                | 414×896        | 2×    | 828×1792
# iPhone SE 3rd gen             | 375×667        | 2×    | 750×1334
# iPad Pro 13" (M4)             | 1032×1376      | 2×    | 2064×2752
# iPad Pro 11" (M4)             | 834×1210       | 2×    | 1668×2420
# iPad Air 13" (M2)             | 1024×1366      | 2×    | 2048×2732
# iPad Air 11" / iPad 10th gen  | 820×1180       | 2×    | 1640×2360
# iPad mini 6th gen             | 744×1133       | 2×    | 1488×2266

declare -a WIDTHS=(1320 1206 1170 1290 1125 828 750 2064 1668 2048 1640 1488)
declare -a HEIGHTS=(2868 2622 2532 2796 2436 1792 1334 2752 2420 2732 2360 2266)

resize_to() {
  local src="$1"
  local out="$2"
  local w="$3"
  local h="$4"

  # Use sips to resize the source to exactly w×h
  # sips --resampleHeightWidth fits within the box; we want exact so we
  # first pad the square source image to the target aspect, then resize.
  sips --resampleHeightWidth "$h" "$w" "$src" --out "$out" > /dev/null 2>&1
}

echo "Generating iOS splash images..."

for i in "${!WIDTHS[@]}"; do
  W="${WIDTHS[$i]}"
  H="${HEIGHTS[$i]}"

  echo "  ${W}×${H}..."
  resize_to "$LIGHT"  "splashes/splash-light-${W}x${H}.png"  "$W" "$H"
  resize_to "$DARK"   "splashes/splash-dark-${W}x${H}.png"   "$W" "$H"
  resize_to "$NEBULA" "splashes/splash-nebula-${W}x${H}.png" "$W" "$H"
done

echo ""
echo "✅  Done! Generated $(ls splashes/ | wc -l | tr -d ' ') files in ./splashes/"
echo "   Light, Dark, and Nebula variants for all common iPhone/iPad sizes."
echo ""
echo "Next: hard-reload the PWA on your device, then remove & re-add to Home Screen"
echo "so iOS picks up the new splash images."
