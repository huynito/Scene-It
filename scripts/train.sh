#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Splatfacto Training Script — Optimized for Synthetic C4D Scenes
#
# Proven parameters from empirical testing on architectural room-scale scenes
# rendered in Cinema 4D and trained with nerfstudio splatfacto.
#
# Prerequisites:
#   - gsplat 1.4.0 (pinned — 1.5.x changes rasterization/densification behavior)
#   - CUDA_HOME=/usr/local/cuda  (required for JIT compilation on Blackwell GPUs)
#   - nerfstudio with splatfacto model
#
# Usage:
#   ./train.sh /path/to/colmap_dataset
#   ./train.sh /path/to/colmap_dataset my_experiment_name
#   EXPORT_ONLY=1 ./train.sh /path/to/colmap_dataset my_experiment_name
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DATA_DIR="${1:?Usage: ./train.sh <data_dir> [experiment_name]}"
EXPERIMENT="${2:-$(basename "$DATA_DIR")}"
OUTPUT_DIR="${OUTPUT_DIR:-/mnt/d/nerfstudio_outputs}"

# ─────────────────────────────────────────────────────────────────────────────
# PROVEN SETTINGS (tested and validated)
# ─────────────────────────────────────────────────────────────────────────────
#
# num-downscales 1:
#   Winner over default (2) and 0. Slight but real quality improvement for
#   synthetic data — fewer coarse initial Gaussians. 0 is too aggressive
#   (noisy early Gaussians cause blurring).
#
# densify-grad-thresh 0.0004:
#   2x more aggressive than default (0.0008). Fills in detail through more
#   splitting. CAUTION: problematic when combined with too many cameras —
#   causes multiplicative Gaussian growth. Keep camera count balanced.
#
# max-num-iterations 30000:
#   DO NOT EXCEED without patching the position LR scheduler (max_steps=30000
#   is hardcoded). Beyond 30k, Gaussian positions freeze while appearance
#   keeps training → over-smoothing and smearing.
#
# Initial points: 4M via uniform_point_sampler.py is the sweet spot for
#   room-scale scenes. 7M showed no improvement.
# ─────────────────────────────────────────────────────────────────────────────

if [ -z "${EXPORT_ONLY:-}" ]; then
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Training: $EXPERIMENT"
    echo "  Data:     $DATA_DIR"
    echo "  Output:   $OUTPUT_DIR"
    echo "═══════════════════════════════════════════════════════════════"

    ns-train splatfacto \
        --output-dir "$OUTPUT_DIR" \
        --experiment-name "$EXPERIMENT" \
        --max-num-iterations 30000 \
        --vis tensorboard \
        --pipeline.model.num-downscales 1 \
        --pipeline.model.densify-grad-thresh 0.0004 \
        --pipeline.model.sh-degree 3 \
        --data "$DATA_DIR" \
        colmap

    # ─────────────────────────────────────────────────────────────────
    # EXPERIMENTAL FLAGS — uncomment to test
    # ─────────────────────────────────────────────────────────────────
    # Add these BEFORE the --data argument in the ns-train command:
    #
    # --pipeline.model.rasterize-mode antialiased
    #   Multi-scale rendering fix. Applies a 2D low-pass filter so splats
    #   render consistently at different viewing distances. HIGH PRIORITY
    #   to test — directly addresses the "looks good from base rig, falls
    #   apart up close" problem.
    #
    # --pipeline.model.cull-alpha-thresh 0.005
    #   More aggressive culling of near-transparent splats during training.
    #   Default 0.1 may let floaters survive. Lower = more aggressive.
    #
    # --pipeline.model.continue-cull-post-densification true
    #   Keep culling after densification ends at iteration 15k.
    #   Late-forming floaters would otherwise persist.
    #
    # --pipeline.model.num-random 0
    #   Skip random Gaussian initialization. Only useful when your uniform
    #   sampler already provides clean geometry-aware starting points.
    #
    # --pipeline.model.absgrad true
    #   Uses absolute gradient magnitude for densification instead of norm.
    #   May improve multi-scale behavior. Check if available in your version.
    #
    # ─────────────────────────────────────────────────────────────────
    # CONFIRMED HARMFUL — do NOT use
    # ─────────────────────────────────────────────────────────────────
    # --pipeline.model.num-downscales 0       → noisy early Gaussians
    # --pipeline.model.reset-alpha-every 15   → black voids
    # --pipeline.model.reset-alpha-every 25   → ghosting/smearing
    # --max-num-iterations 40000+             → position LR freezes at 30k
    # Mixed focal lengths                     → floaters, haze, blurring
    # ─────────────────────────────────────────────────────────────────
fi

# ─────────────────────────────────────────────────────────────────────────────
# Export — auto-detect latest training run
# ─────────────────────────────────────────────────────────────────────────────

EXPORT_DIR="${EXPORT_DIR:-$(dirname "$DATA_DIR")/export/${EXPERIMENT}}"
CONFIG=$(ls -dt "$OUTPUT_DIR"/"$EXPERIMENT"/splatfacto/*/config.yml 2>/dev/null | head -1)

if [ -z "$CONFIG" ]; then
    echo "No training config found for experiment '$EXPERIMENT'"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Exporting: $EXPERIMENT"
echo "  Config:    $CONFIG"
echo "  Export to: $EXPORT_DIR"
echo "═══════════════════════════════════════════════════════════════"

ns-export gaussian-splat \
    --load-config "$CONFIG" \
    --output-dir "$EXPORT_DIR"

echo ""
echo "Export complete: $EXPORT_DIR"
echo ""
echo "Optional post-processing:"
echo "  python scripts/ply_cleanup.py \"$EXPORT_DIR/splat.ply\" -o \"$EXPORT_DIR/splat_cleaned.ply\" --stats"
