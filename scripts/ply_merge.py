#!/usr/bin/env python3
"""
Merge spatial regions from multiple splatfacto PLY exports into a single file.

Extracts the best-quality regions from different training runs and stitches
them together. Each input PLY can be paired with a bounding box to select
only the splats from that region.

Supports three selection modes:
  - bbox:   Axis-aligned bounding box (6 floats)
  - sphere: Center point + radius (4 floats)
  - all:    Keep all splats from the input (no spatial filter)

Overlap handling: When regions overlap, splats from ALL contributing sources
are included. Use the --dedupe flag to remove near-duplicate splats in overlap
zones (keeps the splat with higher opacity).

Usage:
    # Merge three regions from three different training runs:
    python ply_merge.py -o merged.ply \
      --input run1.ply --bbox "-5,-1,-5,0,4,5" \
      --input run2.ply --bbox "0,-1,-5,5,4,5" \
      --input run3.ply --sphere "2,1,0,1.5"

    # Take everything from one run, just a region from another:
    python ply_merge.py -o merged.ply \
      --input base_run.ply --region all \
      --input detail_run.ply --bbox "1,0,1,3,2,3"

    # Merge with deduplication in overlap zones:
    python ply_merge.py -o merged.ply --dedupe 0.001 \
      --input run1.ply --bbox "-5,-1,-5,1,4,5" \
      --input run2.ply --bbox "-1,-1,-5,5,4,5"
"""

import argparse
import sys
from pathlib import Path

import numpy as np


# ── PLY I/O (shared with ply_cleanup.py) ────────────────────────────────────

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


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def load_splat_ply(path: Path):
    data = path.read_bytes()
    header_end, vertex_count, properties = parse_ply_header(data)
    header_text = data[:header_end].decode("ascii")

    np_dtype = np.dtype([(name, numpy_dtype(dt)) for name, dt in properties])
    vertex_bytes = data[header_end:]

    expected = vertex_count * np_dtype.itemsize
    if len(vertex_bytes) < expected:
        raise ValueError(f"PLY truncated: expected {expected} bytes, got {len(vertex_bytes)}")

    vertices = np.frombuffer(vertex_bytes[:expected], dtype=np_dtype)
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


# ── Spatial selection ───────────────────────────────────────────────────────

def select_bbox(vertices, bbox):
    xmin, ymin, zmin, xmax, ymax, zmax = bbox
    mask = (
        (vertices["x"] >= xmin) & (vertices["x"] <= xmax) &
        (vertices["y"] >= ymin) & (vertices["y"] <= ymax) &
        (vertices["z"] >= zmin) & (vertices["z"] <= zmax)
    )
    return vertices[mask]


def select_sphere(vertices, sphere):
    cx, cy, cz, r = sphere
    dx = vertices["x"] - cx
    dy = vertices["y"] - cy
    dz = vertices["z"] - cz
    dist_sq = dx * dx + dy * dy + dz * dz
    return vertices[dist_sq <= r * r]


# ── Deduplication ───────────────────────────────────────────────────────────

def deduplicate(vertices, distance_threshold: float):
    """Remove near-duplicate splats, keeping the one with higher opacity."""
    from scipy.spatial import cKDTree

    positions = np.column_stack([
        vertices["x"].astype(np.float64),
        vertices["y"].astype(np.float64),
        vertices["z"].astype(np.float64),
    ])

    tree = cKDTree(positions)
    pairs = tree.query_pairs(r=distance_threshold, output_type="ndarray")

    if len(pairs) == 0:
        return vertices, 0

    opacities = sigmoid(vertices["opacity"].astype(np.float64))

    remove = set()
    for i, j in pairs:
        if i in remove or j in remove:
            continue
        if opacities[i] >= opacities[j]:
            remove.add(j)
        else:
            remove.add(i)

    keep_mask = np.ones(len(vertices), dtype=bool)
    keep_mask[list(remove)] = False

    return vertices[keep_mask], len(remove)


# ── Argument parsing ────────────────────────────────────────────────────────

class InputAction(argparse.Action):
    """Custom action to collect --input / --bbox / --sphere / --region groups."""
    def __call__(self, parser, namespace, values, option_string=None):
        if not hasattr(namespace, "_inputs") or namespace._inputs is None:
            namespace._inputs = []
        namespace._inputs.append({"path": Path(values), "region_type": "all", "region": None})


class RegionAction(argparse.Action):
    """Attach a region spec to the most recent --input."""
    def __call__(self, parser, namespace, values, option_string=None):
        if not hasattr(namespace, "_inputs") or not namespace._inputs:
            parser.error(f"{option_string} must follow an --input argument")

        entry = namespace._inputs[-1]

        if option_string == "--bbox":
            parts = [float(x) for x in values.split(",")]
            if len(parts) != 6:
                parser.error("--bbox requires 6 comma-separated floats")
            entry["region_type"] = "bbox"
            entry["region"] = tuple(parts)
        elif option_string == "--exclude-bbox":
            parts = [float(x) for x in values.split(",")]
            if len(parts) != 6:
                parser.error("--exclude-bbox requires 6 comma-separated floats")
            entry["region_type"] = "exclude-bbox"
            entry["region"] = tuple(parts)
        elif option_string == "--sphere":
            parts = [float(x) for x in values.split(",")]
            if len(parts) != 4:
                parser.error("--sphere requires 4 comma-separated floats: cx,cy,cz,r")
            entry["region_type"] = "sphere"
            entry["region"] = tuple(parts)
        elif option_string == "--exclude-sphere":
            parts = [float(x) for x in values.split(",")]
            if len(parts) != 4:
                parser.error("--exclude-sphere requires 4 comma-separated floats: cx,cy,cz,r")
            entry["region_type"] = "exclude-sphere"
            entry["region"] = tuple(parts)
        elif option_string == "--region":
            if values != "all":
                parser.error("--region only supports 'all'")
            entry["region_type"] = "all"
            entry["region"] = None


def main():
    parser = argparse.ArgumentParser(
        description="Merge spatial regions from multiple splatfacto PLY exports.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", action=InputAction, metavar="PLY_FILE",
                        help="Input PLY file (repeat for each source)")
    parser.add_argument("--bbox", action=RegionAction, metavar="x0,y0,z0,x1,y1,z1",
                        help="Select splats within bounding box (follows --input)")
    parser.add_argument("--exclude-bbox", action=RegionAction, metavar="x0,y0,z0,x1,y1,z1",
                        help="Select all splats EXCEPT those in bounding box (follows --input)")
    parser.add_argument("--sphere", action=RegionAction, metavar="cx,cy,cz,r",
                        help="Select splats within sphere (follows --input)")
    parser.add_argument("--exclude-sphere", action=RegionAction, metavar="cx,cy,cz,r",
                        help="Select all splats EXCEPT those in sphere (follows --input)")
    parser.add_argument("--region", action=RegionAction, metavar="all",
                        help="Select all splats from this input (follows --input)")
    parser.add_argument("-o", "--output", type=Path, required=True,
                        help="Output PLY file")
    parser.add_argument("--dedupe", type=float, default=None, metavar="DIST",
                        help="Deduplicate splats closer than DIST (keeps higher opacity)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be merged without writing output")

    args = parser.parse_args()

    inputs = getattr(args, "_inputs", None) or []
    if len(inputs) < 1:
        parser.error("At least one --input is required")

    # Validate all files exist before loading
    for entry in inputs:
        if not entry["path"].exists():
            print(f"Error: {entry['path']} not found", file=sys.stderr)
            sys.exit(1)

    # Load and select from each input
    reference_header = None
    reference_dtype = None
    chunks = []

    for i, entry in enumerate(inputs):
        path = entry["path"]
        region_type = entry["region_type"]
        region = entry["region"]

        label = f"  [{i+1}] {path.name}"
        if region_type == "bbox":
            label += f" bbox={region}"
        elif region_type == "exclude-bbox":
            label += f" exclude-bbox={region}"
        elif region_type == "sphere":
            label += f" sphere={region}"
        elif region_type == "exclude-sphere":
            label += f" exclude-sphere={region}"
        else:
            label += " (all)"

        print(f"Loading {path}...")
        header_text, count, properties, vertices = load_splat_ply(path)

        if reference_header is None:
            reference_header = header_text
            reference_dtype = vertices.dtype
        else:
            if vertices.dtype != reference_dtype:
                print(f"  Warning: {path.name} has different properties than first input.",
                      file=sys.stderr)
                print(f"  First: {list(reference_dtype.names)}", file=sys.stderr)
                print(f"  This:  {list(vertices.dtype.names)}", file=sys.stderr)
                print(f"  Skipping this input.", file=sys.stderr)
                continue

        # Apply spatial selection
        if region_type == "bbox":
            selected = select_bbox(vertices, region)
        elif region_type == "exclude-bbox":
            xmin, ymin, zmin, xmax, ymax, zmax = region
            inside = (
                (vertices["x"] >= xmin) & (vertices["x"] <= xmax) &
                (vertices["y"] >= ymin) & (vertices["y"] <= ymax) &
                (vertices["z"] >= zmin) & (vertices["z"] <= zmax)
            )
            selected = vertices[~inside]
        elif region_type == "sphere":
            selected = select_sphere(vertices, region)
        elif region_type == "exclude-sphere":
            cx, cy, cz, r = region
            dx = vertices["x"] - cx
            dy = vertices["y"] - cy
            dz = vertices["z"] - cz
            inside = (dx * dx + dy * dy + dz * dz) <= r * r
            selected = vertices[~inside]
        else:
            selected = vertices

        print(f"{label}: {count:,} total → {len(selected):,} selected")
        chunks.append(selected)

    if not chunks:
        print("Error: no splats selected from any input", file=sys.stderr)
        sys.exit(1)

    merged = np.concatenate(chunks)
    print(f"\nMerged: {len(merged):,} splats from {len(chunks)} sources")

    # Deduplication
    if args.dedupe is not None and args.dedupe > 0:
        print(f"\nDeduplicating (distance threshold: {args.dedupe})...")
        merged, removed = deduplicate(merged, args.dedupe)
        print(f"  Removed {removed:,} near-duplicate splats")
        print(f"  Final: {len(merged):,} splats")

    # Bounds of final output
    positions = np.column_stack([merged["x"], merged["y"], merged["z"]])
    pmin = positions.min(axis=0)
    pmax = positions.max(axis=0)
    print(f"\nOutput bounds: ({pmin[0]:.2f}, {pmin[1]:.2f}, {pmin[2]:.2f}) → "
          f"({pmax[0]:.2f}, {pmax[1]:.2f}, {pmax[2]:.2f})")

    if args.dry_run:
        print("\nDry run — no files written.")
        return

    print(f"\nWriting {args.output}...")
    write_splat_ply(args.output, reference_header, merged)
    print(f"Done. {len(merged):,} splats written.")


if __name__ == "__main__":
    main()
