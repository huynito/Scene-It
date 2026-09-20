#!/usr/bin/env python3
"""
Merge two COLMAP points3D.txt files.

Combines the original COLMAP Bridge output with uniformly sampled points,
re-indexing the second file's point IDs to avoid collisions.

Usage:
    python merge_points3d.py <original_points3D.txt> <uniform_points3D.txt> [-o output.txt] [--backup]

Examples:
    python merge_points3d.py colmap/points3D.txt ~/Desktop/points3D_uniform.txt -o colmap/points3D.txt --backup
    python merge_points3d.py colmap/points3D.txt ~/Desktop/points3D_uniform.txt -o colmap/points3D_merged.txt
"""

import argparse
import os
import shutil
import sys


def parse_points3d(filepath):
    """Parse a COLMAP points3D.txt file.

    Returns (header_lines, point_lines, max_id) where:
      - header_lines: list of comment/header lines (starting with #)
      - point_lines: list of raw data lines
      - max_id: the highest POINT3D_ID found
    """
    header_lines = []
    point_lines = []
    max_id = 0

    with open(filepath, "r") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                header_lines.append(line)
            else:
                point_lines.append(stripped)
                try:
                    pid = int(stripped.split()[0])
                    max_id = max(max_id, pid)
                except (ValueError, IndexError):
                    pass

    return header_lines, point_lines, max_id


def reindex_points(point_lines, start_id):
    """Replace the POINT3D_ID in each line, starting from start_id."""
    reindexed = []
    current_id = start_id
    for line in point_lines:
        parts = line.split(None, 1)
        if len(parts) >= 2:
            reindexed.append(f"{current_id} {parts[1]}")
        elif len(parts) == 1:
            reindexed.append(f"{current_id}")
        current_id += 1
    return reindexed


def main():
    parser = argparse.ArgumentParser(
        description="Merge two COLMAP points3D.txt files with re-indexed IDs."
    )
    parser.add_argument("original", help="Path to the original COLMAP Bridge points3D.txt")
    parser.add_argument("uniform", help="Path to the uniformly sampled points3D_uniform.txt")
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Output path (defaults to printing to stdout)",
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Back up the original file before overwriting (adds .bak extension)",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.original):
        print(f"Error: original file not found: {args.original}", file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(args.uniform):
        print(f"Error: uniform file not found: {args.uniform}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading original: {args.original}")
    orig_headers, orig_points, orig_max_id = parse_points3d(args.original)
    print(f"  {len(orig_points):,} points, max ID: {orig_max_id}")

    print(f"Reading uniform:  {args.uniform}")
    _, uniform_points, _ = parse_points3d(args.uniform)
    print(f"  {len(uniform_points):,} points")

    new_start_id = orig_max_id + 1
    reindexed_uniform = reindex_points(uniform_points, new_start_id)
    total = len(orig_points) + len(reindexed_uniform)
    print(f"Merged total: {total:,} points (uniform IDs start at {new_start_id})")

    if args.output:
        if args.backup and os.path.isfile(args.output) and os.path.abspath(args.output) == os.path.abspath(args.original):
            backup_path = args.original + ".bak"
            shutil.copy2(args.original, backup_path)
            print(f"Backup saved to: {backup_path}")

        out_dir = os.path.dirname(args.output)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir)

        with open(args.output, "w") as f:
            for h in orig_headers:
                f.write(h if h.endswith("\n") else h + "\n")
            for line in orig_points:
                f.write(line + "\n")
            for line in reindexed_uniform:
                f.write(line + "\n")

        print(f"Written to: {args.output}")
    else:
        for h in orig_headers:
            sys.stdout.write(h if h.endswith("\n") else h + "\n")
        for line in orig_points:
            print(line)
        for line in reindexed_uniform:
            print(line)


if __name__ == "__main__":
    main()
