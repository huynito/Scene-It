#!/usr/bin/env python3
"""
Post-training PLY cleanup for splatfacto Gaussian Splat exports.

Removes floaters and artifacts by filtering on opacity, scale, and
spatial isolation. Optionally crops to a bounding box.

Splatfacto PLY format:
  - Binary little-endian, one vertex per Gaussian
  - Fields: x y z, nx ny nz, f_dc_*, f_rest_*, opacity, scale_0/1/2, rot_0/1/2/3
  - opacity is logit-encoded (apply sigmoid to get [0,1])
  - scale is log-encoded (apply exp to get world-space size)

Usage:
    python ply_cleanup.py input.ply -o cleaned.ply
    python ply_cleanup.py input.ply -o cleaned.ply --min-opacity 0.01
    python ply_cleanup.py input.ply -o cleaned.ply --max-scale-sigma 3.0
    python ply_cleanup.py input.ply -o cleaned.ply --isolation-k 3 --isolation-radius auto
    python ply_cleanup.py input.ply -o cleaned.ply --bbox "-5,-1,-5,5,4,5"
    python ply_cleanup.py input.ply -o cleaned.ply --dry-run
"""

import argparse
import struct
import sys
from pathlib import Path

import numpy as np


# ── PLY I/O ─────────────────────────────────────────────────────────────────

def parse_ply_header(data: bytes):
    """Parse a binary little-endian PLY header.

    Returns (header_bytes, vertex_count, properties) where properties is a
    list of (name, dtype) tuples.
    """
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
            # parts: ["property", type, name]
            dtype = parts[1]
            name = parts[2]
            properties.append((name, dtype))

    return header_end, vertex_count, properties


def dtype_size(dtype: str) -> int:
    """Size in bytes for a PLY property type."""
    return {"float": 4, "double": 8, "uchar": 1, "int": 4, "uint": 4,
            "short": 2, "ushort": 2, "char": 1}[dtype]


def numpy_dtype(dtype: str):
    """Convert PLY type string to numpy dtype."""
    return {"float": np.float32, "double": np.float64, "uchar": np.uint8,
            "int": np.int32, "uint": np.uint32, "short": np.int16,
            "ushort": np.uint16, "char": np.int8}[dtype]


def load_splat_ply(path: Path):
    """Load a splatfacto PLY file.

    Returns (header_text, vertex_count, properties, vertex_data) where
    vertex_data is a structured numpy array.
    """
    data = path.read_bytes()
    header_end, vertex_count, properties = parse_ply_header(data)
    header_text = data[:header_end].decode("ascii")

    np_dtype = np.dtype([(name, numpy_dtype(dt)) for name, dt in properties])
    vertex_bytes = data[header_end:]

    expected = vertex_count * np_dtype.itemsize
    if len(vertex_bytes) < expected:
        raise ValueError(
            f"PLY truncated: expected {expected} bytes of vertex data, "
            f"got {len(vertex_bytes)}"
        )

    vertices = np.frombuffer(vertex_bytes[:expected], dtype=np_dtype)
    return header_text, vertex_count, properties, vertices


def write_splat_ply(path: Path, header_text: str, vertices: np.ndarray):
    """Write a splatfacto PLY file, updating the vertex count in the header."""
    new_count = len(vertices)
    lines = header_text.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith("element vertex"):
            lines[i] = f"element vertex {new_count}"
            break
    new_header = "\n".join(lines)
    if not new_header.endswith("\n"):
        new_header += "\n"

    # Don't re-add end_header if it's already there
    header_bytes = new_header.encode("ascii")
    path.write_bytes(header_bytes + vertices.tobytes())


# ── Filters ─────────────────────────────────────────────────────────────────

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def filter_opacity(vertices, min_opacity: float):
    """Remove splats with opacity below threshold (after sigmoid decoding)."""
    if "opacity" not in vertices.dtype.names:
        print("  Warning: no 'opacity' field found, skipping opacity filter")
        return vertices, 0

    opacities = sigmoid(vertices["opacity"].astype(np.float64))
    mask = opacities >= min_opacity
    removed = int(np.sum(~mask))
    return vertices[mask], removed


def filter_scale(vertices, max_sigma: float = None, max_percentile: float = None):
    """Remove splats with oversized scale values.

    Either max_sigma (standard deviations above mean) or max_percentile
    (percentile threshold) can be used.
    """
    scale_names = [n for n in vertices.dtype.names if n.startswith("scale_")]
    if not scale_names:
        print("  Warning: no scale fields found, skipping scale filter")
        return vertices, 0

    scales = np.column_stack([np.exp(vertices[s].astype(np.float64)) for s in scale_names])
    max_scale_per_splat = scales.max(axis=1)

    if max_percentile is not None:
        threshold = np.percentile(max_scale_per_splat, max_percentile)
    elif max_sigma is not None:
        mean = np.mean(max_scale_per_splat)
        std = np.std(max_scale_per_splat)
        threshold = mean + max_sigma * std
    else:
        return vertices, 0

    mask = max_scale_per_splat <= threshold
    removed = int(np.sum(~mask))
    return vertices[mask], removed


def filter_isolation(vertices, k: int = 3, radius: float = None):
    """Remove spatially isolated splats using KD-tree neighbor counting."""
    from scipy.spatial import cKDTree

    positions = np.column_stack([
        vertices["x"].astype(np.float64),
        vertices["y"].astype(np.float64),
        vertices["z"].astype(np.float64),
    ])

    tree = cKDTree(positions)

    if radius is None or radius <= 0:
        # Auto-derive radius from median nearest-neighbor distance
        sample_size = min(10000, len(positions))
        sample_idx = np.random.default_rng(42).choice(
            len(positions), sample_size, replace=False
        )
        dists, _ = tree.query(positions[sample_idx], k=2)
        median_nn = np.median(dists[:, 1])
        radius = median_nn * 10.0
        print(f"  Auto-derived isolation radius: {radius:.4f} "
              f"(10x median NN distance {median_nn:.4f})")

    counts = tree.query_ball_point(positions, r=radius, workers=-1,
                                   return_length=True)
    # counts includes the point itself, so threshold is k+1
    mask = counts >= (k + 1)
    removed = int(np.sum(~mask))
    return vertices[mask], removed


def filter_bbox(vertices, bbox):
    """Keep only splats within an axis-aligned bounding box.

    bbox: (xmin, ymin, zmin, xmax, ymax, zmax)
    """
    x = vertices["x"]
    y = vertices["y"]
    z = vertices["z"]
    xmin, ymin, zmin, xmax, ymax, zmax = bbox

    mask = (
        (x >= xmin) & (x <= xmax) &
        (y >= ymin) & (y <= ymax) &
        (z >= zmin) & (z <= zmax)
    )
    removed = int(np.sum(~mask))
    return vertices[mask], removed


# ── Stats ───────────────────────────────────────────────────────────────────

def print_stats(vertices, label=""):
    """Print summary statistics for a set of splats."""
    prefix = f"  [{label}] " if label else "  "
    n = len(vertices)
    print(f"{prefix}{n:,} splats")

    if "opacity" in vertices.dtype.names:
        opacities = sigmoid(vertices["opacity"].astype(np.float64))
        print(f"{prefix}  opacity: min={opacities.min():.4f}  "
              f"median={np.median(opacities):.4f}  max={opacities.max():.4f}")

    scale_names = [s for s in vertices.dtype.names if s.startswith("scale_")]
    if scale_names:
        scales = np.column_stack([np.exp(vertices[s].astype(np.float64)) for s in scale_names])
        max_scales = scales.max(axis=1)
        print(f"{prefix}  max_scale: mean={max_scales.mean():.4f}  "
              f"median={np.median(max_scales):.4f}  "
              f"p99={np.percentile(max_scales, 99):.4f}  "
              f"p99.5={np.percentile(max_scales, 99.5):.4f}  "
              f"max={max_scales.max():.4f}")

    positions = np.column_stack([vertices["x"], vertices["y"], vertices["z"]])
    pmin = positions.min(axis=0)
    pmax = positions.max(axis=0)
    print(f"{prefix}  bounds: ({pmin[0]:.2f}, {pmin[1]:.2f}, {pmin[2]:.2f}) → "
          f"({pmax[0]:.2f}, {pmax[1]:.2f}, {pmax[2]:.2f})")


# ── Main ────────────────────────────────────────────────────────────────────

def parse_bbox(s: str):
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 6:
        raise argparse.ArgumentTypeError(
            "bbox must be 6 comma-separated floats: xmin,ymin,zmin,xmax,ymax,zmax"
        )
    return tuple(parts)


def main():
    parser = argparse.ArgumentParser(
        description="Clean up splatfacto PLY exports by removing floaters and artifacts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("input", type=Path, help="Input PLY file")
    parser.add_argument("-o", "--output", type=Path, default=None,
                        help="Output PLY file (default: <input>_cleaned.ply)")
    parser.add_argument("--min-opacity", type=float, default=0.005,
                        help="Remove splats with sigmoid(opacity) below this (default: 0.005)")
    parser.add_argument("--max-scale-percentile", type=float, default=None,
                        help="Remove splats with max scale above this percentile (e.g. 99.5)")
    parser.add_argument("--max-scale-sigma", type=float, default=None,
                        help="Remove splats with max scale above mean + N*sigma (e.g. 3.0)")
    parser.add_argument("--isolation-k", type=int, default=None,
                        help="Remove splats with fewer than K neighbors within radius (e.g. 3)")
    parser.add_argument("--isolation-radius", type=str, default="auto",
                        help="Radius for isolation filter ('auto' or a float)")
    parser.add_argument("--bbox", type=parse_bbox, default=None,
                        help="Crop to bounding box: xmin,ymin,zmin,xmax,ymax,zmax")
    parser.add_argument("--no-opacity", action="store_true",
                        help="Skip opacity filter")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be removed without writing output")
    parser.add_argument("--stats", action="store_true",
                        help="Print detailed statistics before and after")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {args.input}...")
    header_text, original_count, properties, vertices = load_splat_ply(args.input)
    print(f"  {original_count:,} splats, {len(properties)} properties per splat")

    if args.stats:
        print_stats(vertices, "input")

    total_removed = 0

    # Opacity filter
    if not args.no_opacity:
        print(f"\nOpacity filter (min={args.min_opacity})...")
        vertices, removed = filter_opacity(vertices, args.min_opacity)
        total_removed += removed
        print(f"  Removed {removed:,} splats ({removed/original_count*100:.1f}%)")

    # Scale filter
    if args.max_scale_percentile is not None or args.max_scale_sigma is not None:
        label = (f"percentile={args.max_scale_percentile}" if args.max_scale_percentile
                 else f"sigma={args.max_scale_sigma}")
        print(f"\nScale filter ({label})...")
        vertices, removed = filter_scale(
            vertices,
            max_sigma=args.max_scale_sigma,
            max_percentile=args.max_scale_percentile,
        )
        total_removed += removed
        print(f"  Removed {removed:,} splats ({removed/original_count*100:.1f}%)")

    # Isolation filter
    if args.isolation_k is not None:
        radius = None if args.isolation_radius == "auto" else float(args.isolation_radius)
        print(f"\nIsolation filter (k={args.isolation_k}, radius={args.isolation_radius})...")
        vertices, removed = filter_isolation(vertices, args.isolation_k, radius)
        total_removed += removed
        print(f"  Removed {removed:,} splats ({removed/original_count*100:.1f}%)")

    # Bounding box crop
    if args.bbox is not None:
        print(f"\nBounding box crop {args.bbox}...")
        vertices, removed = filter_bbox(vertices, args.bbox)
        total_removed += removed
        print(f"  Removed {removed:,} splats ({removed/original_count*100:.1f}%)")

    # Summary
    final_count = len(vertices)
    print(f"\n{'─' * 50}")
    print(f"  Original:  {original_count:,}")
    print(f"  Removed:   {total_removed:,} ({total_removed/original_count*100:.1f}%)")
    print(f"  Remaining: {final_count:,} ({final_count/original_count*100:.1f}%)")
    print(f"{'─' * 50}")

    if args.stats:
        print_stats(vertices, "output")

    if args.dry_run:
        print("\nDry run — no files written.")
        return

    output_path = args.output
    if output_path is None:
        output_path = args.input.with_stem(args.input.stem + "_cleaned")

    print(f"\nWriting {output_path}...")
    write_splat_ply(output_path, header_text, vertices)
    print(f"Done. {final_count:,} splats written.")


if __name__ == "__main__":
    main()
