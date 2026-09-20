#!/usr/bin/env bash
set -euo pipefail

REPO="bhuynh22/gaussian-scene-viewer"
TAG="assets"
SCENES_DIR="public/scenes"
CHUNK_SIZE="50m"

echo "==> Uploading scene assets to GitHub Release '$TAG'..."

# Create the release if it doesn't exist; ignore error if it already exists.
gh release create "$TAG" \
  --repo "$REPO" \
  --title "Scene Assets" \
  --notes "Large scene files (PLY, GLB, floorplans) served to the app at runtime." \
  2>/dev/null || echo "    Release '$TAG' already exists, uploading to it."

STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

GH_TOKEN=$(gh auth token -h ghe.oculus-rep.com)
UPLOAD_URL=$(gh api "repos/$REPO/releases/tags/$TAG" --jq '.upload_url' | sed 's/{.*//')

for scene_dir in "$SCENES_DIR"/*/; do
  scene_id=$(basename "$scene_dir")

  for file in "$scene_dir"*.ply "$scene_dir"*.glb "$scene_dir"*.png "$scene_dir"*.jpg; do
    [ -f "$file" ] || continue

    filename=$(basename "$file")

    case "$filename" in
      thumb.*) echo "    skipping $file (thumbnail ships with app)"; continue ;;
    esac

    asset_name="${scene_id}--${filename}"
    size_mb=$(du -m "$file" | cut -f1)

    if [ "$size_mb" -gt 50 ]; then
      echo "    splitting $file (${size_mb}MB) into ${CHUNK_SIZE} chunks..."
      split -b "$CHUNK_SIZE" -d -a 2 "$file" "$STAGING/${asset_name}."
      ls "$STAGING/${asset_name}."* | while read -r chunk; do
        echo "      staged $(basename "$chunk")"
      done
    else
      cp "$file" "$STAGING/$asset_name"
      echo "    staged $file -> $asset_name"
    fi
  done
done

echo "==> Uploading staged files one at a time (GHE has per-file size limits)..."
for f in "$STAGING"/*; do
  name=$(basename "$f")
  size=$(du -h "$f" | cut -f1)
  echo -n "    $name ($size)... "
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
    -X POST \
    -H "Authorization: token $GH_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    -T "$f" \
    "${UPLOAD_URL}?name=$name")
  if [ "$HTTP_CODE" = "201" ]; then
    echo "OK"
  elif [ "$HTTP_CODE" = "422" ]; then
    echo "already exists, deleting and re-uploading..."
    ASSET_ID=$(gh api "repos/$REPO/releases/tags/$TAG" --jq ".assets[] | select(.name==\"$name\") | .id")
    gh api -X DELETE "repos/$REPO/releases/assets/$ASSET_ID" 2>/dev/null
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
      -X POST \
      -H "Authorization: token $GH_TOKEN" \
      -H "Content-Type: application/octet-stream" \
      -T "$f" \
      "${UPLOAD_URL}?name=$name")
    echo "    -> HTTP $HTTP_CODE"
  else
    echo "FAILED (HTTP $HTTP_CODE)"
    exit 1
  fi
done

echo ""
echo "==> Done. Assets available at:"
echo "    https://ghe.oculus-rep.com/$REPO/releases/download/$TAG/<asset-name>"
echo ""
echo "    Uploaded assets:"
ls -1 "$STAGING"
