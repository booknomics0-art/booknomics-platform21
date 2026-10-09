#!/usr/bin/env bash
# Downloads the two Google Fonts used by the cover worker (SIL Open Font
# License) from the npm registry into ./fonts. Run once per checkout.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"
cd "$TMP"
npm pack --silent @expo-google-fonts/playfair-display @expo-google-fonts/inter >/dev/null
for f in *.tgz; do
  mkdir -p "x-$f" && tar -xzf "$f" -C "x-$f"
done

pick() { find . -name "$1" -print -quit; }
cp "$(pick PlayfairDisplay_700Bold.ttf)" "$OUT/PlayfairDisplay-Bold.ttf"
cp "$(pick PlayfairDisplay_400Regular_Italic.ttf)" "$OUT/PlayfairDisplay-Italic.ttf"
cp "$(pick Inter_600SemiBold.ttf)" "$OUT/Inter-SemiBold.ttf"
cp "$(pick Inter_500Medium.ttf)" "$OUT/Inter-Medium.ttf"

echo "Fonts ready in $OUT"
