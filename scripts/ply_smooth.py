#!/usr/bin/env python3
"""
Smooth Gaussian positions within a region by projecting them onto fitted planes.
Designed for flattening metallic surface artifacts (waviness, denting) on
Gaussian Splatting PLY files.

Supports normal-based filtering to isolate a specific surface (e.g., the front
face of a fridge) from a bounding box that also contains other objects, by
computing each Gaussian's orientation from its rotation quaternion and scales.

Workflow:
  1. Select Gaussians inside a bounding box or sphere
  2. Optionally filter by surface normal direction (--normal-dir + --normal-angle)
  3. Smooth via plane projection or neighbor averaging
  4. Optionally zero higher-order SH coefficients in the region

Run with --dry-run first to preview what would change.

Usage:
    # Inspect scene coordinates
    python ply_smooth.py inspect input.ply

    # Slice a region for verification in SuperSplat
    python ply_smooth.py slice input.ply --bbox "x0,y0,z0,x1,y1,z1" -o region.ply

    # Slice only Gaussians facing a specific direction
    python ply_smooth.py slice input.ply --bbox "x0,y0,z0,x1,y1,z1" \
        --normal-dir "0,0,-1" --normal-angle 30 -o fridge_face.ply

    # Plane-project with normal filtering (safe for mixed-object bounding boxes)
    python ply_smooth.py smooth input.ply --bbox "x0,y0,z0,x1,y1,z1" \
        --mode plane --normal-dir "0,0,-1" --normal-angle 30 --dry-run
"""

import argparse
import sys
from pathlib import Path

import numpy as np

# ── PLY I/O (shared with ply_cleanup.py) ─────────────────────────────────────

def parse_ply_header(data: bytes):
    header_end = data.index(b"end_header\n") + len(b"end_header\n")
    header_text = data[:header_end].decode("ascii")
    vertex_count = 0
    properties = []
    for line in header_text.split("\n"):
        line = line.strip()
        if line.startswith("element vertex"):
            vertex_count = int(line.split()[-1])
        elif line.startswith("property"):
            parts = line.split()
            properties.append((parts[2], parts[1]))
    return header_end, vertex_count, properties


def numpy_dtype(dtype: str):
    return {"float": np.float32, "double": np.float64, "uchar": np.uint8,
            "int": np.int32, "uint": np.uint32, "short": np.int16,
            "ushort": np.uint16, "char": np.int8}[dtype]


def load_splat_ply(path: Path):
    data = path.read_bytes()
    header_end, vertex_count, properties = parse_ply_header(data)
    header_text = data[:header_end].decode("ascii")
    np_dtype = np.dtype([(name, numpy_dtype(dt)) for name, dt in properties])
    vertex_bytes = data[header_end:]
    expected = vertex_count * np_dtype.itemsize
    if len(vertex_bytes) < expected:
        raise ValueError(f"PLY truncated: expected {expected} bytes, got {len(vertex_bytes)}")
    vertices = np.frombuffer(vertex_bytes[:expected], dtype=np_dtype).copy()
    return header_text, vertex_count, properties, vertices


def write_splat_ply(path: Path, header_text: str, vertices: np.ndarray):
    new_count = len(vertices)
    lines = header_text.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith("element vertex"):
            lines[i] = f"element vertex {new_count}"
            break
    new_header = "\n".join(lines)
    if not new_header.endswith("\n"):
        new_header += "\n"
    path.write_bytes(new_header.encode("ascii") + vertices.tobytes())


# ── Plane fitting ────────────────────────────────────────────────────────────

def fit_plane(points: np.ndarray, ref_normal=None):
    """Fit a plane to 3D points via SVD. Returns (normal, centroid).
    If ref_normal is given, flips the normal to align with it."""
    centroid = points.mean(axis=0)
    centered = points - centroid
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    normal = vh[-1]
    if ref_normal is not None:
        if np.dot(normal, ref_normal) < 0:
            normal = -normal
    elif normal[1] < 0:
        normal = -normal
    return normal, centroid


def project_to_plane(points: np.ndarray, normal: np.ndarray, centroid: np.ndarray):
    """Project points onto a plane defined by normal and centroid."""
    dists = np.dot(points - centroid, normal)
    return points - np.outer(dists, normal), dists


def estimate_normals_and_cluster(points: np.ndarray, n_clusters: int, k_neighbors: int = 30):
    """Estimate per-point normals via local PCA, then cluster by normal direction."""
    from scipy.spatial import cKDTree

    tree = cKDTree(points)
    k = min(k_neighbors, len(points))
    _, indices = tree.query(points, k=k)

    normals = np.zeros_like(points)
    for i in range(len(points)):
        neighbors = points[indices[i]]
        centered = neighbors - neighbors.mean(axis=0)
        _, _, vh = np.linalg.svd(centered, full_matrices=False)
        n = vh[-1]
        if n[1] < 0:
            n = -n
        normals[i] = n

    labels = _kmeans_numpy(normals, n_clusters)
    return normals, labels


def _kmeans_numpy(data: np.ndarray, k: int, max_iter: int = 100) -> np.ndarray:
    """Simple k-means using only numpy. Returns 1-based labels."""
    rng = np.random.default_rng(42)
    indices = rng.choice(len(data), size=k, replace=False)
    centers = data[indices].copy()

    for _ in range(max_iter):
        dists = np.linalg.norm(data[:, None] - centers[None], axis=2)
        labels = np.argmin(dists, axis=1)
        new_centers = np.array([data[labels == i].mean(axis=0) if np.any(labels == i)
                                else centers[i] for i in range(k)])
        if np.allclose(centers, new_centers, atol=1e-6):
            break
        centers = new_centers

    return labels + 1


# ── Gaussian normal computation ──────────────────────────────────────────────

def compute_gaussian_normals(vertices, indices=None):
    """
    Compute surface normal for each Gaussian from its rotation quaternion and
    scales. The normal is the rotation matrix column corresponding to the
    thinnest scale axis (the flat side of the pancake-shaped Gaussian).

    Fully vectorized -- handles 1M+ Gaussians efficiently.
    """
    if indices is not None:
        sel = vertices[indices]
    else:
        sel = vertices

    qw = sel["rot_0"].astype(np.float64)
    qx = sel["rot_1"].astype(np.float64)
    qy = sel["rot_2"].astype(np.float64)
    qz = sel["rot_3"].astype(np.float64)

    scales = np.column_stack([
        sel["scale_0"].astype(np.float64),
        sel["scale_1"].astype(np.float64),
        sel["scale_2"].astype(np.float64),
    ])
    thin_axis = np.argmin(scales, axis=1)

    col0 = np.column_stack([
        1 - 2*(qy*qy + qz*qz),
        2*(qx*qy + qw*qz),
        2*(qx*qz - qw*qy),
    ])
    col1 = np.column_stack([
        2*(qx*qy - qw*qz),
        1 - 2*(qx*qx + qz*qz),
        2*(qy*qz + qw*qx),
    ])
    col2 = np.column_stack([
        2*(qx*qz + qw*qy),
        2*(qy*qz - qw*qx),
        1 - 2*(qx*qx + qy*qy),
    ])

    all_cols = np.stack([col0, col1, col2], axis=1)
    n = len(sel)
    normals = all_cols[np.arange(n), thin_axis]

    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normals /= norms

    return normals


def filter_by_normal(normals, ref_direction, max_angle_degrees):
    """
    Return a boolean mask for normals aligned with ref_direction within
    max_angle_degrees. Uses absolute dot product since Gaussian normals
    can face either direction.
    """
    ref = np.array(ref_direction, dtype=np.float64)
    ref /= np.linalg.norm(ref)
    dots = np.abs(np.sum(normals * ref, axis=1))
    dots = np.clip(dots, 0, 1)
    angles = np.degrees(np.arccos(dots))
    return angles <= max_angle_degrees, angles


# ── Main ─────────────────────────────────────────────────────────────────────

def parse_bbox(s: str):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 6:
        raise argparse.ArgumentTypeError("bbox must be 6 comma-separated floats: x0,y0,z0,x1,y1,z1")
    return tuple(parts)


def parse_center_radius(s: str):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("Must be 4 comma-separated floats: cx,cy,cz,radius")
    return tuple(parts)


def parse_normal_dir(s: str):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("Must be 3 comma-separated floats: dx,dy,dz")
    mag = sum(x*x for x in parts) ** 0.5
    if mag < 1e-8:
        raise argparse.ArgumentTypeError("Normal direction must be non-zero")
    return tuple(parts)


def cmd_inspect(args):
    """Print scene bounds and axis histograms to help locate objects."""
    print(f"Loading {args.input}...")
    _, total_count, _, vertices = load_splat_ply(args.input)
    print(f"  {total_count:,} Gaussians\n")

    x = vertices["x"].astype(np.float64)
    y = vertices["y"].astype(np.float64)
    z = vertices["z"].astype(np.float64)

    print(f"  Scene bounds:")
    print(f"    X: {x.min():.3f} to {x.max():.3f}  (range {x.max()-x.min():.3f})")
    print(f"    Y: {y.min():.3f} to {y.max():.3f}  (range {y.max()-y.min():.3f})")
    print(f"    Z: {z.min():.3f} to {z.max():.3f}  (range {z.max()-z.min():.3f})")
    print(f"    Center: ({x.mean():.3f}, {y.mean():.3f}, {z.mean():.3f})")

    def histogram(values, label, bins=20):
        counts, edges = np.histogram(values, bins=bins)
        max_count = counts.max()
        print(f"\n  {label} distribution:")
        for i in range(len(counts)):
            bar_len = int(40 * counts[i] / max_count) if max_count > 0 else 0
            print(f"    {edges[i]:7.3f} | {'█' * bar_len} {counts[i]:,}")
        print(f"    {edges[-1]:7.3f} |")

    histogram(x, "X axis")
    histogram(y, "Y axis")
    histogram(z, "Z axis")


def main():
    parser = argparse.ArgumentParser(
        description="Smooth Gaussian positions by projecting onto fitted planes within a region.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command")

    inspect_p = sub.add_parser("inspect", help="Print scene bounds and coordinate histograms")
    inspect_p.add_argument("input", type=Path, help="Input PLY file")

    slice_p = sub.add_parser("slice", help="Export a region as a separate PLY for verification in SuperSplat")
    slice_p.add_argument("input", type=Path, help="Input PLY file")
    slice_p.add_argument("-o", "--output", type=Path, required=True, help="Output PLY file")
    slice_region = slice_p.add_mutually_exclusive_group(required=True)
    slice_region.add_argument("--bbox", type=parse_bbox, help="Bounding box: x0,y0,z0,x1,y1,z1")
    slice_region.add_argument("--sphere", type=parse_center_radius, help="Sphere: cx,cy,cz,radius")
    slice_p.add_argument("--normal-dir", type=parse_normal_dir, default=None,
                         help="Filter by Gaussian normal direction: dx,dy,dz "
                              "(keeps only Gaussians facing this direction)")
    slice_p.add_argument("--normal-angle", type=float, default=30.0,
                         help="Max angle deviation from --normal-dir in degrees (default: 30)")

    smooth_p = sub.add_parser("smooth", help="Smooth Gaussian positions within a region")
    smooth_p.add_argument("input", type=Path, help="Input PLY file")

    region = smooth_p.add_mutually_exclusive_group(required=True)
    region.add_argument("--bbox", type=parse_bbox,
                        help="Bounding box: x0,y0,z0,x1,y1,z1")
    region.add_argument("--sphere", type=parse_center_radius,
                        help="Sphere selection: cx,cy,cz,radius")
    smooth_p.add_argument("-o", "--output", type=Path, default=None,
                        help="Output PLY file (default: <input>_smoothed.ply)")
    smooth_p.add_argument("--mode", choices=["plane", "neighbor"], default="neighbor",
                        help="Smoothing mode: 'neighbor' (local position averaging, safer) "
                             "or 'plane' (project onto fitted planes)")
    smooth_p.add_argument("--planes", type=int, default=3,
                        help="Number of planar clusters to fit (plane mode only, default: 3)")
    smooth_p.add_argument("--iterations", type=int, default=3,
                        help="Smoothing iterations (neighbor mode only, default: 3)")
    smooth_p.add_argument("--strength", type=float, default=0.3,
                        help="How much to move toward neighbors per iteration (0-1, default: 0.3)")
    smooth_p.add_argument("--threshold", type=float, default=0.0,
                        help="Only move Gaussians more than this distance from the fitted plane. "
                             "0 moves all (default). Increase to preserve edge detail.")
    smooth_p.add_argument("--margin", type=float, default=0.0,
                        help="Shrink the effective bbox by this amount on each side (default: 0)")
    smooth_p.add_argument("--zero-sh", action="store_true",
                        help="Zero higher-order SH coefficients (f_rest_*) in the region "
                             "to remove view-dependent color noise")
    smooth_p.add_argument("--normal-dir", type=parse_normal_dir, default=None,
                        help="Filter by Gaussian normal direction: dx,dy,dz "
                             "(keeps only Gaussians facing this direction, "
                             "excludes other surfaces in the bounding box)")
    smooth_p.add_argument("--normal-angle", type=float, default=30.0,
                        help="Max angle deviation from --normal-dir in degrees (default: 30)")
    smooth_p.add_argument("--dry-run", action="store_true",
                        help="Preview what would change without writing output")
    smooth_p.add_argument("--k-neighbors", type=int, default=30,
                        help="Neighbors for normal estimation (default: 30)")
    args = parser.parse_args()

    if args.command == "inspect":
        cmd_inspect(args)
        return

    if args.command == "slice":
        print(f"Loading {args.input}...")
        header_text, total_count, _, vertices = load_splat_ply(args.input)
        print(f"  {total_count:,} Gaussians")
        if args.bbox:
            x0, y0, z0, x1, y1, z1 = args.bbox
            mask = (
                (vertices["x"] >= x0) & (vertices["x"] <= x1) &
                (vertices["y"] >= y0) & (vertices["y"] <= y1) &
                (vertices["z"] >= z0) & (vertices["z"] <= z1)
            )
            print(f"  Box: ({x0},{y0},{z0}) -> ({x1},{y1},{z1})")
        else:
            cx, cy, cz, r = args.sphere
            dx = vertices["x"].astype(np.float64) - cx
            dy = vertices["y"].astype(np.float64) - cy
            dz = vertices["z"].astype(np.float64) - cz
            mask = (dx*dx + dy*dy + dz*dz) <= r*r
            print(f"  Sphere: center=({cx},{cy},{cz}), radius={r}")
        spatial_count = int(mask.sum())
        print(f"  Spatial selection: {spatial_count:,} Gaussians ({spatial_count/total_count*100:.1f}%)")

        if args.normal_dir is not None and spatial_count > 0:
            spatial_indices = np.where(mask)[0]
            normals = compute_gaussian_normals(vertices, spatial_indices)
            normal_mask, angles = filter_by_normal(normals, args.normal_dir, args.normal_angle)
            print(f"  Normal filter: dir=({args.normal_dir[0]:.2f},{args.normal_dir[1]:.2f},"
                  f"{args.normal_dir[2]:.2f}), max angle={args.normal_angle:.0f}\u00b0")
            print(f"  Passed filter: {int(normal_mask.sum()):,} / {spatial_count:,} "
                  f"({100*normal_mask.sum()/spatial_count:.1f}%)")
            if normal_mask.sum() > 0:
                print(f"  Angle range: {angles[normal_mask].min():.1f}\u00b0 - "
                      f"{angles[normal_mask].max():.1f}\u00b0 "
                      f"(mean {angles[normal_mask].mean():.1f}\u00b0)")
            mask = np.zeros(len(vertices), dtype=bool)
            mask[spatial_indices[normal_mask]] = True

        subset = vertices[mask]
        print(f"  Final selection: {len(subset):,} Gaussians")
        if len(subset) == 0:
            print("  Nothing selected -- check coordinates or normal direction.")
            return
        write_splat_ply(args.output, header_text, subset)
        print(f"  Written to {args.output}")
        return

    if args.command is None:
        parser.print_help()
        return

    if not args.input.exists():
        print(f"Error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {args.input}...")
    header_text, total_count, properties, vertices = load_splat_ply(args.input)
    print(f"  {total_count:,} Gaussians, {len(properties)} properties each")

    if args.bbox:
        x0, y0, z0, x1, y1, z1 = args.bbox
        mx, my, mz = args.margin, args.margin, args.margin
        mask = (
            (vertices["x"] >= x0 + mx) & (vertices["x"] <= x1 - mx) &
            (vertices["y"] >= y0 + my) & (vertices["y"] <= y1 - my) &
            (vertices["z"] >= z0 + mz) & (vertices["z"] <= z1 - mz)
        )
        print(f"\n  Bounding box: ({x0}, {y0}, {z0}) -> ({x1}, {y1}, {z1})")
    else:
        cx, cy, cz, radius = args.sphere
        dx = vertices["x"].astype(np.float64) - cx
        dy = vertices["y"].astype(np.float64) - cy
        dz = vertices["z"].astype(np.float64) - cz
        dist_sq = dx*dx + dy*dy + dz*dz
        mask = dist_sq <= radius * radius
        print(f"\n  Sphere: center=({cx}, {cy}, {cz}), radius={radius}")
    region_indices = np.where(mask)[0]
    n_spatial = len(region_indices)
    if args.bbox and args.margin > 0:
        print(f"  Margin: {args.margin}")
    print(f"  Gaussians in region: {n_spatial:,} ({n_spatial/total_count*100:.1f}%)")

    if hasattr(args, 'normal_dir') and args.normal_dir is not None and n_spatial > 0:
        normals = compute_gaussian_normals(vertices, region_indices)
        normal_mask, angles = filter_by_normal(normals, args.normal_dir, args.normal_angle)
        print(f"\n  Normal filter: dir=({args.normal_dir[0]:.2f},{args.normal_dir[1]:.2f},"
              f"{args.normal_dir[2]:.2f}), max angle={args.normal_angle:.0f}\u00b0")
        print(f"  Passed filter: {int(normal_mask.sum()):,} / {n_spatial:,} "
              f"({100*normal_mask.sum()/n_spatial:.1f}%)")
        if normal_mask.sum() > 0:
            print(f"  Angle range: {angles[normal_mask].min():.1f}\u00b0 - "
                  f"{angles[normal_mask].max():.1f}\u00b0 "
                  f"(mean {angles[normal_mask].mean():.1f}\u00b0)")
        region_indices = region_indices[normal_mask]

    n_region = len(region_indices)
    if n_region < 10:
        print("  Too few Gaussians after filtering -- check bounding box or normal direction.")
        sys.exit(1)

    positions = np.column_stack([
        vertices["x"][region_indices].astype(np.float64),
        vertices["y"][region_indices].astype(np.float64),
        vertices["z"][region_indices].astype(np.float64),
    ])

    total_moved = 0
    total_sh_zeroed = 0

    if args.mode == "neighbor":
        from scipy.spatial import cKDTree

        k = min(args.k_neighbors, n_region)
        tree = cKDTree(positions)
        _, indices = tree.query(positions, k=k)

        smoothed = positions.copy()
        for it in range(args.iterations):
            neighbor_avg = positions[indices].mean(axis=1)
            new_pos = smoothed + args.strength * (neighbor_avg - smoothed)

            displacement = np.linalg.norm(new_pos - smoothed, axis=1)
            if args.threshold > 0:
                move_mask = displacement > args.threshold
            else:
                move_mask = np.ones(n_region, dtype=bool)

            smoothed[move_mask] = new_pos[move_mask]

            n_moved_iter = int(move_mask.sum())
            avg_disp = displacement[move_mask].mean() if n_moved_iter > 0 else 0
            print(f"\n  Iteration {it+1}/{args.iterations}: "
                  f"moved {n_moved_iter:,} Gaussians, avg displacement {avg_disp:.5f}")

        total_disp = np.linalg.norm(smoothed - positions, axis=1)
        moved_mask = total_disp > 1e-8
        total_moved = int(moved_mask.sum())
        avg_total = total_disp[moved_mask].mean() if total_moved > 0 else 0
        max_total = total_disp.max()

        print(f"\n  Total: {total_moved:,} Gaussians moved")
        print(f"  Avg displacement: {avg_total:.5f}, max: {max_total:.5f}")

        if not args.dry_run:
            vertices["x"][region_indices] = smoothed[:, 0].astype(np.float32)
            vertices["y"][region_indices] = smoothed[:, 1].astype(np.float32)
            vertices["z"][region_indices] = smoothed[:, 2].astype(np.float32)

    else:
        ref_normal = np.array(args.normal_dir) if (hasattr(args, 'normal_dir') and args.normal_dir) else None

        if ref_normal is not None:
            # Normal filter already isolated the target surface -- fit a single plane
            print(f"\n  Fitting single plane to {n_region:,} normal-filtered Gaussians...")
            normal, centroid = fit_plane(positions, ref_normal=ref_normal)
            _, dists = project_to_plane(positions, normal, centroid)
            abs_dists = np.abs(dists)

            print(f"    Normal: ({normal[0]:.3f}, {normal[1]:.3f}, {normal[2]:.3f})")
            print(f"    Deviation: mean={abs_dists.mean():.4f}  max={abs_dists.max():.4f}  "
                  f"std={abs_dists.std():.4f}")

            if args.threshold > 0:
                move_mask = abs_dists > args.threshold
                n_move = int(move_mask.sum())
                print(f"    Threshold {args.threshold}: {n_move} of {n_region} Gaussians would be moved")
            else:
                move_mask = np.ones(n_region, dtype=bool)
                n_move = n_region
                print(f"    Moving all {n_move} Gaussians to plane")

            if not args.dry_run and n_move > 0:
                move_global_indices = region_indices[move_mask]
                move_points = positions[move_mask]
                projected, _ = project_to_plane(move_points, normal, centroid)
                vertices["x"][move_global_indices] = projected[:, 0].astype(np.float32)
                vertices["y"][move_global_indices] = projected[:, 1].astype(np.float32)
                vertices["z"][move_global_indices] = projected[:, 2].astype(np.float32)

            total_moved += n_move

        else:
            print(f"\n  Estimating normals (k={args.k_neighbors}) and clustering into {args.planes} planes...")
            normals, labels = estimate_normals_and_cluster(positions, args.planes, args.k_neighbors)

            for plane_id in range(1, args.planes + 1):
                plane_mask = labels == plane_id
                plane_points = positions[plane_mask]
                n_plane = len(plane_points)

                if n_plane < 3:
                    print(f"\n  Plane {plane_id}: {n_plane} Gaussians -- skipping (too few)")
                    continue

                normal, centroid = fit_plane(plane_points)
                _, dists = project_to_plane(plane_points, normal, centroid)
                abs_dists = np.abs(dists)

                print(f"\n  Plane {plane_id}: {n_plane:,} Gaussians")
                print(f"    Normal: ({normal[0]:.3f}, {normal[1]:.3f}, {normal[2]:.3f})")
                print(f"    Deviation: mean={abs_dists.mean():.4f}  max={abs_dists.max():.4f}  "
                      f"std={abs_dists.std():.4f}")

                if args.threshold > 0:
                    move_mask = abs_dists > args.threshold
                    n_move = int(move_mask.sum())
                    print(f"    Threshold {args.threshold}: {n_move} of {n_plane} Gaussians would be moved")
                else:
                    move_mask = np.ones(n_plane, dtype=bool)
                    n_move = n_plane
                    print(f"    Moving all {n_move} Gaussians to plane")

                if not args.dry_run and n_move > 0:
                    plane_region_indices = region_indices[plane_mask]
                    move_global_indices = plane_region_indices[move_mask]
                    move_points = positions[plane_mask][move_mask]
                    projected, _ = project_to_plane(move_points, normal, centroid)
                    vertices["x"][move_global_indices] = projected[:, 0].astype(np.float32)
                    vertices["y"][move_global_indices] = projected[:, 1].astype(np.float32)
                    vertices["z"][move_global_indices] = projected[:, 2].astype(np.float32)

                total_moved += n_move

    if args.zero_sh:
        sh_fields = [n for n in vertices.dtype.names if n.startswith("f_rest_")]
        if sh_fields:
            print(f"\n  Zeroing {len(sh_fields)} SH coefficients for {n_region:,} Gaussians in region...")
            if not args.dry_run:
                for field in sh_fields:
                    vertices[field][region_indices] = 0.0
            total_sh_zeroed = n_region
        else:
            print("\n  No f_rest_* fields found -- SH zeroing skipped")

    print(f"\n{'─' * 50}")
    print(f"  Total Gaussians:    {total_count:,}")
    print(f"  In region:          {n_region:,}")
    print(f"  Positions smoothed: {total_moved:,}")
    if args.zero_sh:
        print(f"  SH zeroed:          {total_sh_zeroed:,}")
    print(f"{'─' * 50}")

    if args.dry_run:
        print("\nDry run -- no files written.")
        return

    output_path = args.output
    if output_path is None:
        output_path = args.input.with_stem(args.input.stem + "_smoothed")

    print(f"\nWriting {output_path}...")
    write_splat_ply(output_path, header_text, vertices)
    print(f"Done.")


if __name__ == "__main__":
    main()
