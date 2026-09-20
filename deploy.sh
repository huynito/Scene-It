#!/usr/bin/env bash
set -euo pipefail

REPO="bhuynh22/scene-it"
BRANCH="gh-pages"
CHUNK_SIZE="50m"

if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | grep -v '^\s*$' | xargs)
fi

if [ -f .env.local ]; then
  echo "WARNING: .env.local exists and will override .env.production values."
  echo "         Rename it to .env.development.local so it only applies to next dev."
  exit 1
fi

echo "==> Building static export..."
npm run build

touch out/.nojekyll

BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
if [ -n "$BASE_PATH" ]; then
  echo "==> Rewriting CSS url() paths with base path: $BASE_PATH"
  for css in out/_next/static/css/*.css; do
    [ -f "$css" ] || continue
    sed -i '' \
      -e "s|url(\"/|url(\"${BASE_PATH}/|g" \
      -e "s|url('/|url('${BASE_PATH}/|g" \
      -e "s|url(/|url(${BASE_PATH}/|g" \
      "$css"
    echo "    patched $css"
  done
fi

echo "==> Splitting large scene assets into <${CHUNK_SIZE} chunks..."
find out/scenes \( -name '*.ply' -o -name '*.glb' -o -name '*.splat' \) | while read -r f; do
  size=$(du -m "$f" | cut -f1)
  if [ "$size" -gt 50 ]; then
    echo "    splitting $f (${size}MB)"
    split -b "$CHUNK_SIZE" -d -a 2 "$f" "${f}."
    rm "$f"
    ls "${f}."* | while read -r chunk; do
      echo "      $(basename "$chunk") ($(du -h "$chunk" | cut -f1))"
    done
  else
    echo "    keeping $f (${size}MB, under limit)"
  fi
done

echo "==> Setting up deploy directory..."
DEPLOY_DIR=$(mktemp -d)
trap 'rm -rf "$DEPLOY_DIR"' EXIT
ORIGIN_URL="$(git remote get-url origin)"

git init "$DEPLOY_DIR"
cp -a out/. "$DEPLOY_DIR"/
cd "$DEPLOY_DIR"
git remote add origin "$ORIGIN_URL"

git add -A -- . ':!scenes/**/*.ply.*' ':!scenes/**/*.glb.*'
git commit -m "deploy app $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
git branch -M "$BRANCH"

echo "==> Pushing app files..."
git -c http.postBuffer=524288000 push -f origin "$BRANCH"

for chunk in scenes/**/*.ply.* scenes/**/*.glb.*; do
  [ -f "$chunk" ] || continue
  echo "==> Pushing $chunk ($(du -h "$chunk" | cut -f1))..."
  git add "$chunk"
  git commit -m "add $chunk"
  git -c http.postBuffer=524288000 push origin "$BRANCH"
done

echo ""
echo "==> Deployed to $BRANCH."
echo "    https://ghe.oculus-rep.com/$REPO/settings => Pages => Source: $BRANCH branch"
echo ""
