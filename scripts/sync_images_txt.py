#!/usr/bin/env python3
"""
Sync images.txt to match the actual image files on disk.

Removes entries from images.txt for any images that no longer exist in the
images directory. Run this after manually deleting unwanted image files.

Usage:
    python sync_images_txt.py /path/to/colmap_dataset
    python sync_images_txt.py /path/to/colmap_dataset --dry-run
    python sync_images_txt.py /path/to/colmap_dataset --images-dir images
"""

import argparse
import shutil
import sys
from pathlib import Path


def find_sparse_dir(data_root):
    for c in [
        data_root / "colmap" / "sparse" / "0",
        data_root / "sparse" / "0",
        data_root / "colmap" / "sparse",
        data_root / "sparse",
    ]:
        if c.is_dir():
            return c
    return None


def sync(data_root, images_dir_name="images", dry_run=False):
    sparse_dir = find_sparse_dir(data_root)
    if sparse_dir is None:
        print("Error: could not find COLMAP sparse directory", file=sys.stderr)
        sys.exit(1)

    images_txt = sparse_dir / "images.txt"
    if not images_txt.exists():
        print(f"Error: {images_txt} not found", file=sys.stderr)
        sys.exit(1)

    images_dir = data_root / images_dir_name
    if not images_dir.is_dir():
        print(f"Error: {images_dir} not found", file=sys.stderr)
        sys.exit(1)

    existing_files = set()
    for f in images_dir.rglob("*"):
        if f.is_file():
            existing_files.add(str(f.relative_to(images_dir)))

    kept = []
    removed = []
    header_lines = []

    with open(images_txt, "r") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                header_lines.append(line)
                continue

            parts = stripped.split()
            if len(parts) >= 10:
                image_name = parts[9]
                points_line = next(f, "")

                if image_name in existing_files:
                    kept.append((line, points_line))
                else:
                    removed.append(image_name)

    print(f"Images on disk:     {len(existing_files)}")
    print(f"Entries in file:    {len(kept) + len(removed)}")
    print(f"Keeping:            {len(kept)}")
    print(f"Removing:           {len(removed)}")

    if removed:
        print(f"\nRemoved entries:")
        for name in sorted(removed):
            print(f"  {name}")

    if dry_run:
        print("\nDry run — no files modified.")
        return

    if not removed:
        print("\nNothing to remove — images.txt is already in sync.")
        return

    backup = images_txt.with_suffix(".txt.bak")
    shutil.copy2(images_txt, backup)
    print(f"\nBackup saved to: {backup}")

    with open(images_txt, "w") as f:
        for line in header_lines:
            f.write(line)
        for img_line, pts_line in kept:
            f.write(img_line)
            f.write(pts_line)

    print(f"Updated: {images_txt}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync images.txt to match image files on disk."
    )
    parser.add_argument("data", type=Path, help="Path to COLMAP dataset root")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be removed without modifying anything")
    parser.add_argument("--images-dir", type=str, default="images",
                        help="Name of the images subdirectory (default: images)")
    args = parser.parse_args()

    sync(args.data.resolve(), args.images_dir, args.dry_run)
