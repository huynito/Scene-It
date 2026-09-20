#!/usr/bin/env bash
set -euo pipefail

REPO="bhuynh22/scene-it"
TAG="assets"
SCENES_DIR="public/scenes"
GHE_HOST="ghe.oculus-rep.com"

echo "==> Downloading scene assets from GitHub Release '$TAG'..."

ASSETS=$(gh api "repos/$REPO/releases/tags/$TAG" \
  --hostname "$GHE_HOST" \
  --jq '.assets[].name')

if [ -z "$ASSETS" ]; then
  echo "    No assets found on release '$TAG'. Ask the repo owner to run upload-assets.sh first."
  exit 1
fi

DOWNLOAD_BASE="https://$GHE_HOST/$REPO/releases/download/$TAG"
GH_TOKEN=$(gh auth token -h "$GHE_HOST")

mkdir -p "$SCENES_DIR"

for asset_name in $ASSETS; do
  scene_id="${asset_name%%--*}"
  rest="${asset_name#*--}"

  # Strip chunk suffix (.00, .01, ...) to get the original filename
  base_filename=$(echo "$rest" | sed -E 's/\.[0-9]{2}$//')
  dest_dir="$SCENES_DIR/$scene_id"
  dest_file="$dest_dir/$base_filename"

  mkdir -p "$dest_dir"

  if [ "$rest" = "$base_filename" ]; then
    # Non-chunked file — skip if already present
    if [ -f "$dest_file" ]; then
      echo "    $dest_file already exists, skipping"
      continue
    fi
    echo -n "    downloading $asset_name -> $dest_file ... "
    curl -sL \
      -H "Authorization: token $GH_TOKEN" \
      -H "Accept: application/octet-stream" \
      "$DOWNLOAD_BASE/$asset_name" \
      -o "$dest_file"
    echo "OK ($(du -h "$dest_file" | cut -f1))"
  else
    # Chunked file — download chunk to staging
    chunk_dir="$dest_dir/.chunks"
    mkdir -p "$chunk_dir"
    chunk_dest="$chunk_dir/$asset_name"
    echo -n "    downloading chunk $asset_name ... "
    curl -sL \
      -H "Authorization: token $GH_TOKEN" \
      -H "Accept: application/octet-stream" \
      "$DOWNLOAD_BASE/$asset_name" \
      -o "$chunk_dest"
    echo "OK ($(du -h "$chunk_dest" | cut -f1))"
  fi
done

echo "==> Reassembling chunked files..."
for scene_dir in "$SCENES_DIR"/*/; do
  chunk_dir="$scene_dir/.chunks"
  [ -d "$chunk_dir" ] || continue

  scene_id=$(basename "$scene_dir")

  # Group chunks by base filename
  for chunk in "$chunk_dir"/*; do
    basename "$chunk"
  done | sed -E 's/\.[0-9]{2}$//' | sort -u | while read -r asset_base; do
    base_filename="${asset_base#*--}"
    dest_file="$scene_dir$base_filename"

    if [ -f "$dest_file" ]; then
      echo "    $dest_file already exists, skipping reassembly"
      continue
    fi

    echo -n "    reassembling $dest_file ... "
    cat "$chunk_dir/${asset_base}."* > "$dest_file"
    echo "OK ($(du -h "$dest_file" | cut -f1))"
  done

  rm -rf "$chunk_dir"
done

echo ""
echo "==> Done. Scene files are in $SCENES_DIR/:"
for scene_dir in "$SCENES_DIR"/*/; do
  scene_id=$(basename "$scene_dir")
  echo "    $scene_id:"
  ls -lh "$scene_dir" | tail -n +2 | while read -r line; do
    echo "      $line"
  done
done
