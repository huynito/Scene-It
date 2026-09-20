#!/usr/bin/env python3
"""
Generate monocular depth maps from training images using Depth Anything V2.

Produces relative depth estimates from existing RGB renders for use as
geometric supervision during Gaussian Splatting training. Designed for
synthetic C4D renders but works on any images.

Output format is compatible with nerfstudio's colmap dataparser (depth
images in a sibling depth/ directory with matching filenames as .npy files)
and can also be adapted for gsplat standalone training.

Prerequisites:
    pip install torch torchvision transformers pillow numpy

Usage:
    python generate_depth_maps.py /path/to/colmap_dataset
    python generate_depth_maps.py /path/to/colmap_dataset --model large
    python generate_depth_maps.py /path/to/colmap_dataset --dry-run
    python generate_depth_maps.py /path/to/colmap_dataset --images-dir images --output-dir depth
"""

import argparse
import sys
from pathlib import Path

import numpy as np

try:
    import torch
    from PIL import Image
except ImportError:
    print("Missing dependencies. Install with:", file=sys.stderr)
    print("  pip install torch torchvision pillow numpy", file=sys.stderr)
    sys.exit(1)


MODEL_CONFIGS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
    "large": "depth-anything/Depth-Anything-V2-Large-hf",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}


def load_model(model_size: str, device: str):
    """Load Depth Anything V2 via HuggingFace transformers pipeline."""
    try:
        from transformers import pipeline
    except ImportError:
        print("Missing transformers library. Install with:", file=sys.stderr)
        print("  pip install transformers", file=sys.stderr)
        sys.exit(1)

    model_id = MODEL_CONFIGS[model_size]
    print(f"Loading model: {model_id}")
    print(f"Device: {device}")

    pipe = pipeline(
        task="depth-estimation",
        model=model_id,
        device=device,
    )
    return pipe


def find_images(images_dir: Path) -> list[Path]:
    """Find all image files in the directory, sorted by name."""
    images = [
        f for f in sorted(images_dir.iterdir())
        if f.suffix.lower() in IMAGE_EXTENSIONS and f.is_file()
    ]
    return images


def process_images(pipe, image_paths: list[Path], output_dir: Path, output_format: str):
    """Run depth estimation on all images and save results."""
    output_dir.mkdir(parents=True, exist_ok=True)
    total = len(image_paths)

    for i, img_path in enumerate(image_paths):
        stem = img_path.stem

        if output_format == "npy":
            out_path = output_dir / f"{stem}.npy"
        else:
            out_path = output_dir / f"{stem}.png"

        if out_path.exists():
            print(f"  [{i+1}/{total}] {stem} -- skipped (exists)")
            continue

        image = Image.open(img_path).convert("RGB")
        result = pipe(image)
        depth = np.array(result["depth"], dtype=np.float32)

        # Normalize to [0, 1] range (relative depth)
        d_min, d_max = depth.min(), depth.max()
        if d_max - d_min > 1e-8:
            depth = (depth - d_min) / (d_max - d_min)

        if output_format == "npy":
            np.save(out_path, depth)
        else:
            depth_16bit = (depth * 65535).astype(np.uint16)
            Image.fromarray(depth_16bit).save(out_path)

        print(f"  [{i+1}/{total}] {stem} -- {depth.shape[1]}x{depth.shape[0]}")

    print(f"\nDone. {total} depth maps saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate monocular depth maps from training images using Depth Anything V2."
    )
    parser.add_argument(
        "data", type=Path,
        help="Path to COLMAP dataset root (parent of images/ directory)"
    )
    parser.add_argument(
        "--model", choices=["small", "base", "large"], default="large",
        help="Model size: small (fastest), base, large (best quality, default)"
    )
    parser.add_argument(
        "--images-dir", type=str, default="images",
        help="Name of the images subdirectory (default: images)"
    )
    parser.add_argument(
        "--output-dir", type=str, default="depth",
        help="Name of the output depth subdirectory (default: depth)"
    )
    parser.add_argument(
        "--format", choices=["npy", "png"], default="npy",
        help="Output format: npy (float32, for nerfstudio) or png (16-bit, visual inspection)"
    )
    parser.add_argument(
        "--device", type=str, default=None,
        help="Device override (default: auto-detect cuda/mps/cpu)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="List images that would be processed without running inference"
    )
    args = parser.parse_args()

    data_root = args.data.resolve()
    if not data_root.is_dir():
        print(f"Error: {data_root} is not a directory", file=sys.stderr)
        sys.exit(1)

    images_dir = data_root / args.images_dir
    if not images_dir.is_dir():
        colmap_images = data_root / "colmap" / args.images_dir
        if colmap_images.is_dir():
            images_dir = colmap_images
        else:
            print(f"Error: images directory not found at {images_dir}", file=sys.stderr)
            print(f"  Also checked: {colmap_images}", file=sys.stderr)
            sys.exit(1)

    output_dir = images_dir.parent / args.output_dir

    image_paths = find_images(images_dir)
    if not image_paths:
        print(f"Error: no images found in {images_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Dataset:    {data_root}")
    print(f"Images:     {images_dir} ({len(image_paths)} files)")
    print(f"Output:     {output_dir}")
    print(f"Format:     {args.format}")
    print(f"Model:      {args.model}")

    if args.dry_run:
        print(f"\nDry run -- {len(image_paths)} images would be processed:")
        for p in image_paths[:10]:
            print(f"  {p.name}")
        if len(image_paths) > 10:
            print(f"  ... and {len(image_paths) - 10} more")
        return

    if args.device:
        device = args.device
    elif torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    pipe = load_model(args.model, device)
    process_images(pipe, image_paths, output_dir, args.format)

    print(f"\nNext steps:")
    print(f"  For nerfstudio splatfacto with depth supervision:")
    print(f"    Add --pipeline.model.depth-loss-mult 0.1 to your training command")
    print(f"  For gsplat standalone:")
    print(f"    Load .npy files as depth supervision in the training loop")


if __name__ == "__main__":
    main()
