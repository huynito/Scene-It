#!/usr/bin/env python3
"""
Analyze and cull COLMAP cameras based on their viewing angle to a target object.

Helps reduce SH reflection conflicts on metallic/specular surfaces by identifying
cameras that view a target object from extreme angles and optionally creating a
filtered dataset that excludes them.

Usage:
    # Analyze which cameras view the trash can and from what angles
    python colmap_target_analysis.py analyze /path/to/colmap_dataset --target 1.2,-0.4,2.7

    # Show detailed per-camera list
    python colmap_target_analysis.py analyze /path/to/colmap_dataset --target 1.2,-0.4,2.7 --list

    # Cull cameras viewing the target from outside the 90-270 degree azimuth range
    python colmap_target_analysis.py cull /path/to/colmap_dataset --target 1.2,-0.4,2.7 \
        --keep-azimuth 90,270 --dry-run

    # Cull cameras from a manually curated exclusion list
    python colmap_target_analysis.py cull /path/to/colmap_dataset --target 1.2,-0.4,2.7 \
        --exclude-list cameras_to_remove.txt

Directory structure expected:
    dataset/
      images/ (or colmap/images/)
      colmap/sparse/0/
        images.bin (or images.txt)
        cameras.bin (or cameras.txt)
        points3D.bin (or points3D.txt)
"""

import argparse
import math
import shutil
import struct
import sys
from pathlib import Path

import numpy as np


# ── COLMAP parsing (standalone copies from colmap_spatial_cull.py) ────────────

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
    forward = R.T @ np.array([0, 0, 1])
    forward /= np.linalg.norm(forward)
    return position, forward


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
            f.read(num_points2d * 24)
            images[image_id] = (name.decode("utf-8"), np.array(qvec), np.array(tvec))
    return images


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
                name = parts[9]
                images[image_id] = (name, qvec, tvec)
                next(f, None)
    return images


def write_images_binary(path, selected_ids):
    """Rewrite images.bin in-place, keeping only selected image IDs."""
    entries = {}
    with open(path, "rb") as f:
        num_images = struct.unpack("<Q", f.read(8))[0]
        for _ in range(num_images):
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


# ── Analysis helpers ─────────────────────────────────────────────────────────

UP_AXES = {
    "y": (0, 2),   # horizontal plane is XZ
    "z": (0, 1),   # horizontal plane is XY
}

SECTOR_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
SECTOR_EDGES = [337.5, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5]


def compute_azimuth(camera_pos, target_pos, up_axis="y"):
    """
    Compute the compass azimuth (0-360) of the camera's position relative to
    the target in the horizontal plane. 0=N (+forward axis), 90=E, 180=S, 270=W.

    For Y-up: N=+Z, E=+X.  For Z-up: N=+Y, E=+X.
    """
    h0, h1 = UP_AXES[up_axis]
    dx = camera_pos[h0] - target_pos[h0]
    dz = camera_pos[h1] - target_pos[h1]
    az = math.degrees(math.atan2(dx, dz)) % 360
    return az


def azimuth_in_range(az, lo, hi):
    """Check if azimuth is within [lo, hi], handling wrap-around at 360."""
    if lo <= hi:
        return lo <= az <= hi
    return az >= lo or az <= hi


def sector_label(az):
    """Return compass sector name for an azimuth."""
    if az >= 337.5 or az < 22.5:
        return "N"
    idx = int((az + 22.5) / 45) % 8
    return SECTOR_NAMES[idx]


# ── Load dataset ─────────────────────────────────────────────────────────────

def load_dataset(data_root):
    """Load COLMAP images and return (images_dict, sparse_dir, use_binary)."""
    sparse_dir = find_sparse_dir(data_root)
    if sparse_dir is None:
        print("Error: could not find COLMAP sparse directory", file=sys.stderr)
        print("Expected one of: colmap/sparse/0, sparse/0, colmap/sparse, sparse",
              file=sys.stderr)
        sys.exit(1)

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
    return images, sparse_dir, use_binary


def compute_camera_info(images, target_pos, fov_half, up_axis):
    """
    For each camera, determine if it views the target and compute azimuth/distance.

    Returns list of dicts with keys:
        image_id, name, position, forward, views_target, view_angle, azimuth, distance
    """
    target = np.array(target_pos)
    results = []

    for img_id in sorted(images.keys()):
        name, qvec, tvec = images[img_id]
        pos, fwd = camera_position_and_direction(qvec, tvec)

        to_target = target - pos
        dist = np.linalg.norm(to_target)
        to_target_norm = to_target / dist if dist > 0 else to_target

        view_angle = math.degrees(math.acos(np.clip(np.dot(fwd, to_target_norm), -1, 1)))
        views_target = view_angle < fov_half
        azimuth = compute_azimuth(pos, target, up_axis)

        results.append({
            "image_id": img_id,
            "name": name,
            "position": pos,
            "forward": fwd,
            "views_target": views_target,
            "view_angle": view_angle,
            "azimuth": azimuth,
            "distance": dist,
        })

    return results


# ── Commands ─────────────────────────────────────────────────────────────────

def cmd_analyze(args):
    data_root = args.data.resolve()
    images, sparse_dir, _ = load_dataset(data_root)
    target_pos = args.target

    infos = compute_camera_info(images, target_pos, args.fov_half, args.up_axis)
    viewing = [c for c in infos if c["views_target"]]
    not_viewing = [c for c in infos if not c["views_target"]]

    print(f"\nTarget: ({target_pos[0]:.3f}, {target_pos[1]:.3f}, {target_pos[2]:.3f})")
    print(f"FOV half-angle: {args.fov_half:.1f}\u00b0")

    print(f"\n{'─' * 60}")
    print(f"  Cameras viewing target:     {len(viewing)} / {len(infos)} "
          f"({100*len(viewing)/len(infos):.1f}%)")
    print(f"  Not viewing target:         {len(not_viewing)} (always kept during cull)")
    if viewing:
        dists = [c["distance"] for c in viewing]
        print(f"  Distance range:             {min(dists):.2f} - {max(dists):.2f}")
        print(f"  Mean distance:              {np.mean(dists):.2f}")
    print(f"{'─' * 60}")

    if not viewing:
        print("\nNo cameras are pointed at the target. Try increasing --fov-half "
              "or check the target coordinates.")
        return

    # Azimuth histogram
    sector_counts = {name: 0 for name in SECTOR_NAMES}
    for c in viewing:
        sector_counts[sector_label(c["azimuth"])] += 1
    max_count = max(sector_counts.values()) if sector_counts else 1

    print(f"\nAzimuth distribution (camera position relative to target):\n")
    print(f"  {'Sector':<6}  {'Range':<16}  {'Count':>5}  Histogram")
    print(f"  {'─' * 56}")
    for i, name in enumerate(SECTOR_NAMES):
        lo = SECTOR_EDGES[i]
        hi = SECTOR_EDGES[(i + 1) % 8]
        count = sector_counts[name]
        bar_len = int(30 * count / max_count) if max_count > 0 else 0
        print(f"  {name:<6}  {lo:5.1f}\u00b0 - {hi:5.1f}\u00b0  {count:5d}  {'█' * bar_len}")
    print()

    # Per-camera list
    if args.list:
        viewing_sorted = sorted(viewing, key=lambda c: c["azimuth"])
        print(f"  {'Azimuth':>8}  {'Dist':>6}  {'View∠':>6}  {'Sector':<6}  Image")
        print(f"  {'─' * 60}")
        for c in viewing_sorted:
            print(f"  {c['azimuth']:7.1f}\u00b0  {c['distance']:5.2f}m  "
                  f"{c['view_angle']:5.1f}\u00b0  {sector_label(c['azimuth']):<6}  {c['name']}")
        print()

    # Save list to file if requested
    if args.save_list:
        viewing_sorted = sorted(viewing, key=lambda c: c["azimuth"])
        with open(args.save_list, "w") as f:
            f.write(f"# Cameras viewing target ({target_pos[0]:.3f}, "
                    f"{target_pos[1]:.3f}, {target_pos[2]:.3f})\n")
            f.write(f"# FOV half-angle: {args.fov_half:.1f}\n")
            f.write(f"# azimuth,distance,view_angle,sector,image_name\n")
            for c in viewing_sorted:
                f.write(f"{c['azimuth']:.1f},{c['distance']:.3f},"
                        f"{c['view_angle']:.1f},{sector_label(c['azimuth'])},"
                        f"{c['name']}\n")
        print(f"Viewing camera list saved to: {args.save_list}")


def cmd_cull(args):
    data_root = args.data.resolve()
    images, sparse_dir, use_binary = load_dataset(data_root)
    target_pos = args.target

    infos = compute_camera_info(images, target_pos, args.fov_half, args.up_axis)
    viewing = [c for c in infos if c["views_target"]]
    not_viewing = [c for c in infos if not c["views_target"]]

    # Determine which viewing cameras to exclude
    exclude_names = set()

    if args.exclude_list:
        with open(args.exclude_list) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    # Support CSV format from --save-list
                    if "," in line:
                        line = line.rsplit(",", 1)[-1]
                    exclude_names.add(line)
        print(f"Loaded {len(exclude_names)} image names from exclusion list")

    if args.keep_azimuth:
        lo, hi = args.keep_azimuth
        for c in viewing:
            if not azimuth_in_range(c["azimuth"], lo, hi):
                exclude_names.add(c["name"])
        print(f"Keeping viewing cameras with azimuth in [{lo:.1f}\u00b0, {hi:.1f}\u00b0]")

    if args.exclude_azimuth:
        lo, hi = args.exclude_azimuth
        for c in viewing:
            if azimuth_in_range(c["azimuth"], lo, hi):
                exclude_names.add(c["name"])
        print(f"Excluding viewing cameras with azimuth in [{lo:.1f}\u00b0, {hi:.1f}\u00b0]")

    if not exclude_names:
        print("No cameras matched the exclusion criteria. Nothing to cull.")
        return

    all_names = {c["name"] for c in infos}
    keep_names = all_names - exclude_names
    keep_ids = set()
    for img_id, (name, _, _) in images.items():
        if name in keep_names:
            keep_ids.add(img_id)

    excluded_viewing = [c for c in viewing if c["name"] in exclude_names]

    print(f"\n{'─' * 60}")
    print(f"  Total images:               {len(infos)}")
    print(f"  Viewing target:             {len(viewing)}")
    print(f"  Excluded (viewing):         {len(excluded_viewing)}")
    print(f"  Kept:                       {len(keep_ids)}")
    print(f"  Not viewing (always kept):  {len(not_viewing)}")
    print(f"{'─' * 60}")

    # Show which sectors are affected
    excluded_sectors = {}
    for c in excluded_viewing:
        s = sector_label(c["azimuth"])
        excluded_sectors[s] = excluded_sectors.get(s, 0) + 1
    if excluded_sectors:
        print(f"\n  Excluded by sector:")
        for s in SECTOR_NAMES:
            if s in excluded_sectors:
                print(f"    {s}: {excluded_sectors[s]} cameras")

    if args.dry_run:
        print(f"\nDry run — no files written.")
        if args.list:
            print(f"\n  Excluded cameras:")
            for c in sorted(excluded_viewing, key=lambda c: c["azimuth"]):
                print(f"    {c['azimuth']:7.1f}\u00b0  {c['distance']:5.2f}m  "
                      f"{sector_label(c['azimuth']):<6}  {c['name']}")
        return

    # Create output directory
    if args.output:
        out_root = args.output.resolve()
    else:
        out_root = data_root.parent / f"{data_root.name}_target_culled"

    images_dir = args.images_dir
    out_images = out_root / images_dir
    out_sparse = out_root / sparse_dir.relative_to(data_root)
    out_images.mkdir(parents=True, exist_ok=True)
    out_sparse.mkdir(parents=True, exist_ok=True)

    # Copy/link images
    src_images = data_root / images_dir
    if not src_images.is_dir():
        src_images = data_root / "colmap" / images_dir
    print(f"\n{'Copying' if args.copy else 'Symlinking'} {len(keep_ids)} images...")
    for img_id in sorted(keep_ids):
        name = images[img_id][0]
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

    # Write filtered COLMAP files
    images_bin = sparse_dir / "images.bin"
    images_txt = sparse_dir / "images.txt"

    if use_binary:
        dst_model = out_sparse / "images.bin"
        shutil.copy2(images_bin, dst_model)
        write_images_binary(dst_model, keep_ids)
    else:
        dst_model = out_sparse / "images.txt"
        write_images_text(dst_model, images_txt, keep_ids)

    for fname in ["cameras.bin", "cameras.txt", "points3D.bin", "points3D.txt"]:
        src = sparse_dir / fname
        if src.exists():
            shutil.copy2(src, out_sparse / fname)

    # Copy depth maps if they exist
    depth_src = data_root / "depth"
    if depth_src.is_dir():
        depth_dst = out_root / "depth"
        depth_dst.mkdir(parents=True, exist_ok=True)
        copied_depth = 0
        for img_id in sorted(keep_ids):
            name = images[img_id][0]
            stem = Path(name).stem
            src = depth_src / f"{stem}.npy"
            if src.exists():
                shutil.copy2(src, depth_dst / f"{stem}.npy")
                copied_depth += 1
        if copied_depth:
            print(f"Copied {copied_depth} depth maps")

    print(f"\nOutput written to: {out_root}")
    print(f"Removed {len(excluded_viewing)} cameras viewing the target from excluded angles.")
    print(f"\nTo train with nerfstudio:")
    print(f"  ns-train splatfacto --data {out_root} colmap")


# ── Argument parsing ─────────────────────────────────────────────────────────

def parse_target(s):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("Target must be 3 comma-separated floats: cx,cy,cz")
    return tuple(parts)


def parse_azimuth_range(s):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("Azimuth range must be 2 comma-separated floats: lo,hi")
    return (parts[0] % 360, parts[1] % 360)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze and cull COLMAP cameras by viewing angle to a target object.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command")

    # ── analyze ──
    analyze_p = sub.add_parser(
        "analyze",
        help="Analyze which cameras view a target point and from what angles",
    )
    analyze_p.add_argument("data", type=Path, help="Path to COLMAP dataset root")
    analyze_p.add_argument("--target", type=parse_target, required=True,
                           help="Target 3D point: cx,cy,cz")
    analyze_p.add_argument("--fov-half", type=float, default=37.0,
                           help="Half-angle of camera FOV in degrees (default: 37, ~24mm full-frame)")
    analyze_p.add_argument("--up-axis", choices=["y", "z"], default="y",
                           help="Scene up axis for azimuth computation (default: y)")
    analyze_p.add_argument("--list", action="store_true",
                           help="Print per-camera details sorted by azimuth")
    analyze_p.add_argument("--save-list", type=Path, default=None,
                           help="Save viewing camera list to a CSV file")

    # ── cull ──
    cull_p = sub.add_parser(
        "cull",
        help="Create a filtered dataset excluding cameras that view the target from specific angles",
    )
    cull_p.add_argument("data", type=Path, help="Path to COLMAP dataset root")
    cull_p.add_argument("--target", type=parse_target, required=True,
                        help="Target 3D point: cx,cy,cz")
    cull_p.add_argument("--fov-half", type=float, default=37.0,
                        help="Half-angle of camera FOV in degrees (default: 37)")
    cull_p.add_argument("--up-axis", choices=["y", "z"], default="y",
                        help="Scene up axis for azimuth computation (default: y)")
    cull_strategy = cull_p.add_mutually_exclusive_group(required=True)
    cull_strategy.add_argument("--keep-azimuth", type=parse_azimuth_range,
                               help="Keep only viewing cameras in this azimuth range: lo,hi (degrees)")
    cull_strategy.add_argument("--exclude-azimuth", type=parse_azimuth_range,
                               help="Exclude viewing cameras in this azimuth range: lo,hi (degrees)")
    cull_strategy.add_argument("--exclude-list", type=Path,
                               help="File with image names to exclude (one per line, or CSV from --save-list)")
    cull_p.add_argument("--output", type=Path, default=None,
                        help="Output directory (default: <data>_target_culled)")
    cull_p.add_argument("--copy", action="store_true",
                        help="Copy images instead of creating symlinks")
    cull_p.add_argument("--images-dir", type=str, default="images",
                        help="Name of the images subdirectory (default: images)")
    cull_p.add_argument("--dry-run", action="store_true",
                        help="Preview what would be removed without writing")
    cull_p.add_argument("--list", action="store_true",
                        help="Print per-camera details in dry-run output")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "cull":
        cmd_cull(args)


if __name__ == "__main__":
    main()
