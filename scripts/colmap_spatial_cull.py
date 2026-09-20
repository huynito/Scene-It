#!/usr/bin/env python3
"""
Spatially cull a COLMAP dataset to a target image count using farthest-point sampling.

Reads camera poses from a COLMAP sparse reconstruction, selects a spatially
well-distributed subset, and writes a new dataset directory compatible with
nerfstudio's colmap dataparser.

Supports both COLMAP text (.txt) and binary (.bin) image formats.

Usage:
    python colmap_spatial_cull.py /path/to/colmap_dataset --target 400
    python colmap_spatial_cull.py /path/to/colmap_dataset --target 400 --direction-weight 0.3
    python colmap_spatial_cull.py /path/to/colmap_dataset --target 400 --dry-run

Directory structure expected:
    dataset/
      images/
      colmap/sparse/0/
        images.bin (or images.txt)
        cameras.bin (or cameras.txt)
        points3D.bin (or points3D.txt)
"""

import argparse
import os
import shutil
import struct
import sys
from pathlib import Path

import numpy as np


def qvec_to_rotmat(qvec):
    """Convert COLMAP quaternion (w, x, y, z) to 3x3 rotation matrix."""
    w, x, y, z = qvec
    return np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*w*z, 2*x*z + 2*w*y],
        [2*x*y + 2*w*z, 1 - 2*x*x - 2*z*z, 2*y*z - 2*w*x],
        [2*x*z - 2*w*y, 2*y*z + 2*w*x, 1 - 2*x*x - 2*y*y],
    ])


def camera_position_and_direction(qvec, tvec):
    """Extract world-space camera position and forward direction from COLMAP extrinsics."""
    R = qvec_to_rotmat(qvec)
    position = -R.T @ tvec
    forward = R.T @ np.array([0, 0, 1])  # camera looks along +Z in COLMAP
    forward /= np.linalg.norm(forward)
    return position, forward


# ── Binary readers ──────────────────────────────────────────────────────────

def read_images_binary(path):
    """Parse COLMAP images.bin. Returns dict of {image_id: (name, qvec, tvec)}."""
    images = {}
    with open(path, "rb") as f:
        num_images = struct.unpack("<Q", f.read(8))[0]
        for _ in range(num_images):
            image_id = struct.unpack("<I", f.read(4))[0]
            qvec = struct.unpack("<4d", f.read(32))
            tvec = struct.unpack("<3d", f.read(24))
            camera_id = struct.unpack("<I", f.read(4))[0]
            name = b""
            while True:
                ch = f.read(1)
                if ch == b"\x00":
                    break
                name += ch
            num_points2d = struct.unpack("<Q", f.read(8))[0]
            # skip 2D points: each is (x, y, point3d_id) = 2 doubles + 1 int64
            f.read(num_points2d * 24)
            images[image_id] = (name.decode("utf-8"), np.array(qvec), np.array(tvec))
    return images


def read_cameras_binary(path):
    """Read COLMAP cameras.bin and return raw bytes for pass-through copy."""
    with open(path, "rb") as f:
        return f.read()


def read_images_text(path):
    """Parse COLMAP images.txt. Returns dict of {image_id: (name, qvec, tvec)}."""
    images = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 10:
                image_id = int(parts[0])
                qvec = np.array([float(parts[1]), float(parts[2]),
                                 float(parts[3]), float(parts[4])])
                tvec = np.array([float(parts[5]), float(parts[6]), float(parts[7])])
                camera_id = int(parts[8])
                name = parts[9]
                images[image_id] = (name, qvec, tvec)
                # images.txt has a second line per image (2D points) — skip it
                next(f, None)
    return images


# ── Binary writers ──────────────────────────────────────────────────────────

def write_images_binary(path, images_dict, selected_ids):
    """Write a new images.bin containing only selected image IDs."""
    # Re-read original to preserve full per-image data (including 2D points)
    original_path = path
    entries = {}

    with open(original_path, "rb") as f:
        num_images = struct.unpack("<Q", f.read(8))[0]
        for _ in range(num_images):
            entry_start = f.tell()
            image_id = struct.unpack("<I", f.read(4))[0]
            qvec = f.read(32)
            tvec = f.read(24)
            camera_id = f.read(4)
            name = b""
            while True:
                ch = f.read(1)
                if ch == b"\x00":
                    break
                name += ch
            num_points2d = struct.unpack("<Q", f.read(8))[0]
            points2d_data = f.read(num_points2d * 24)
            if image_id in selected_ids:
                entries[image_id] = (
                    struct.pack("<I", image_id) + qvec + tvec + camera_id +
                    name + b"\x00" +
                    struct.pack("<Q", num_points2d) + points2d_data
                )

    with open(path, "wb") as f:
        f.write(struct.pack("<Q", len(entries)))
        for image_id in sorted(entries.keys()):
            f.write(entries[image_id])


def write_images_text(path, original_path, selected_ids):
    """Write a new images.txt containing only selected image IDs."""
    with open(original_path, "r") as fin, open(path, "w") as fout:
        for line in fin:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                fout.write(line)
                continue
            parts = stripped.split()
            if len(parts) >= 10:
                image_id = int(parts[0])
                points_line = next(fin, "")
                if image_id in selected_ids:
                    fout.write(line)
                    fout.write(points_line)


# ── Farthest-point sampling ────────────────────────────────────────────────

def farthest_point_sampling(positions, directions, target_count, direction_weight=0.0):
    """
    Greedy farthest-point sampling in position space, optionally weighted by
    viewing direction diversity.

    direction_weight controls how much viewing direction matters vs position:
      0.0 = position only (good for evenly spaced cameras)
      0.3 = mild direction preference (good default for room-scale scenes)
      1.0 = equal weight position and direction
    """
    n = len(positions)
    if target_count >= n:
        return list(range(n))

    # Normalize position and direction spaces to comparable scales
    pos = np.array(positions)
    dirs = np.array(directions)

    pos_range = np.ptp(pos, axis=0).max()
    if pos_range > 0:
        pos_norm = pos / pos_range
    else:
        pos_norm = pos

    # Direction vectors are already unit length; scale by weight
    # Use (1 - cos_similarity) as distance, approximated by euclidean on unit sphere
    dirs_weighted = dirs * direction_weight

    features = np.hstack([pos_norm, dirs_weighted])

    selected = [0]
    min_dists = np.full(n, np.inf)

    for _ in range(target_count - 1):
        last = features[selected[-1]]
        dists = np.linalg.norm(features - last, axis=1)
        min_dists = np.minimum(min_dists, dists)
        min_dists[selected] = -1
        next_idx = np.argmax(min_dists)
        selected.append(next_idx)

    return selected


# ── Main ────────────────────────────────────────────────────────────────────

def find_sparse_dir(data_root):
    """Locate the COLMAP sparse reconstruction directory."""
    candidates = [
        data_root / "colmap" / "sparse" / "0",
        data_root / "sparse" / "0",
        data_root / "colmap" / "sparse",
        data_root / "sparse",
    ]
    for c in candidates:
        if c.is_dir():
            return c
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Spatially cull COLMAP images using farthest-point sampling."
    )
    parser.add_argument("data", type=Path, help="Path to COLMAP dataset root")
    parser.add_argument("--target", type=int, default=400,
                        help="Target number of images to keep (default: 400)")
    parser.add_argument("--direction-weight", type=float, default=0.2,
                        help="Weight for viewing direction in sampling (0=position only, default: 0.2)")
    parser.add_argument("--output", type=Path, default=None,
                        help="Output directory (default: <data>_culled_<target>)")
    parser.add_argument("--copy", action="store_true",
                        help="Copy images instead of creating symlinks")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print selection stats without writing anything")
    parser.add_argument("--images-dir", type=str, default="images",
                        help="Name of the images subdirectory (default: images)")
    args = parser.parse_args()

    data_root = args.data.resolve()
    if not data_root.is_dir():
        print(f"Error: {data_root} is not a directory", file=sys.stderr)
        sys.exit(1)

    sparse_dir = find_sparse_dir(data_root)
    if sparse_dir is None:
        print("Error: could not find COLMAP sparse directory", file=sys.stderr)
        print("Expected one of: colmap/sparse/0, sparse/0, colmap/sparse, sparse", file=sys.stderr)
        sys.exit(1)

    # Detect format and load images
    images_bin = sparse_dir / "images.bin"
    images_txt = sparse_dir / "images.txt"
    use_binary = images_bin.exists()

    if use_binary:
        print(f"Reading {images_bin}")
        images = read_images_binary(images_bin)
    elif images_txt.exists():
        print(f"Reading {images_txt}")
        images = read_images_text(images_txt)
    else:
        print("Error: no images.bin or images.txt found in", sparse_dir, file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(images)} images")

    if args.target >= len(images):
        print(f"Target ({args.target}) >= total images ({len(images)}), nothing to cull.")
        sys.exit(0)

    # Extract poses
    image_ids = sorted(images.keys())
    names = []
    positions = []
    directions = []

    for img_id in image_ids:
        name, qvec, tvec = images[img_id]
        pos, fwd = camera_position_and_direction(qvec, tvec)
        names.append(name)
        positions.append(pos)
        directions.append(fwd)

    positions = np.array(positions)
    directions = np.array(directions)

    # Run farthest-point sampling
    print(f"Selecting {args.target} images (direction weight: {args.direction_weight})...")
    selected_indices = farthest_point_sampling(
        positions, directions, args.target, args.direction_weight
    )
    selected_ids = set(image_ids[i] for i in selected_indices)
    selected_names = [names[i] for i in selected_indices]

    # Stats
    selected_pos = positions[selected_indices]
    from scipy.spatial import ConvexHull
    try:
        hull_all = ConvexHull(positions[:, :2])
        hull_sel = ConvexHull(selected_pos[:, :2])
        coverage = hull_sel.volume / hull_all.volume * 100
    except Exception:
        coverage = None

    dists = np.linalg.norm(np.diff(np.sort(selected_pos, axis=0), axis=0), axis=1)

    print(f"\n{'─' * 50}")
    print(f"  Total images:     {len(images)}")
    print(f"  Selected:         {len(selected_ids)}")
    print(f"  Removed:          {len(images) - len(selected_ids)}")
    if coverage is not None:
        print(f"  2D coverage:      {coverage:.1f}% of original convex hull")
    print(f"  Position range X: {selected_pos[:,0].min():.2f} → {selected_pos[:,0].max():.2f}")
    print(f"  Position range Y: {selected_pos[:,1].min():.2f} → {selected_pos[:,1].max():.2f}")
    print(f"  Position range Z: {selected_pos[:,2].min():.2f} → {selected_pos[:,2].max():.2f}")
    print(f"{'─' * 50}\n")

    if args.dry_run:
        print("Dry run — no files written.")
        print("Selected images:")
        for name in sorted(selected_names):
            print(f"  {name}")
        return

    # Create output directory
    if args.output:
        out_root = args.output.resolve()
    else:
        out_root = data_root.parent / f"{data_root.name}_culled_{args.target}"

    out_images = out_root / args.images_dir
    out_sparse = out_root / sparse_dir.relative_to(data_root)
    out_images.mkdir(parents=True, exist_ok=True)
    out_sparse.mkdir(parents=True, exist_ok=True)

    # Copy/link images
    src_images = data_root / args.images_dir
    print(f"{'Copying' if args.copy else 'Symlinking'} {len(selected_ids)} images...")
    for name in selected_names:
        src = src_images / name
        dst = out_images / name
        if not src.exists():
            print(f"  Warning: {src} not found, skipping")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if args.copy:
            shutil.copy2(src, dst)
        else:
            if dst.exists() or dst.is_symlink():
                dst.unlink()
            dst.symlink_to(src)

    # Write filtered images file
    if use_binary:
        src_images_model = images_bin
        dst_images_model = out_sparse / "images.bin"
        shutil.copy2(src_images_model, dst_images_model)
        write_images_binary(dst_images_model, images, selected_ids)
    else:
        dst_images_model = out_sparse / "images.txt"
        write_images_text(dst_images_model, images_txt, selected_ids)

    # Copy cameras and points3D unchanged
    for fname in ["cameras.bin", "cameras.txt", "points3D.bin", "points3D.txt"]:
        src = sparse_dir / fname
        if src.exists():
            shutil.copy2(src, out_sparse / fname)

    print(f"Output written to: {out_root}")
    print(f"\nTo train with nerfstudio:")
    print(f"  ns-train splatfacto --data {out_root} colmap")


if __name__ == "__main__":
    main()
