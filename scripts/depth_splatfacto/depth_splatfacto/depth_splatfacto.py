"""
Depth-supervised Gaussian Splatting for nerfstudio.

Extends splatfacto with monocular depth supervision using a scale-invariant
Pearson correlation loss (1 - |r|, convention-agnostic). Depth maps are
pre-generated from existing training images using
scripts/generate_depth_maps.py (Depth Anything V2).

Supports annealing the depth weight to zero over the densification phase,
giving early geometric guidance without interfering with later appearance
refinement. This avoids depth supervision conflicting with SH optimization
on view-dependent surfaces.

Registers as 'depth-splatfacto' with nerfstudio. Usage:

    # Constant depth weight:
    ns-train depth-splatfacto \
      --pipeline.model.depth-loss-mult 0.1 \
      --pipeline.datamanager.depth-dir /path/to/depth \
      colmap --data /path/to/colmap_dataset

    # Annealed depth weight (0.1 -> 0.0 over densification):
    ns-train depth-splatfacto \
      --pipeline.model.depth-loss-mult 0.1 \
      --pipeline.model.depth-loss-mult-final 0.0 \
      --pipeline.datamanager.depth-dir /path/to/depth \
      colmap --data /path/to/colmap_dataset
"""

import numpy as np
import torch
import torch.nn.functional as F
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Type

from nerfstudio.data.datamanagers.full_images_datamanager import (
    FullImageDatamanager,
    FullImageDatamanagerConfig,
)
from nerfstudio.data.dataparsers.colmap_dataparser import ColmapDataParserConfig
from nerfstudio.engine.optimizers import AdamOptimizerConfig
from nerfstudio.engine.schedulers import ExponentialDecaySchedulerConfig
from nerfstudio.engine.trainer import TrainerConfig
from nerfstudio.models.splatfacto import SplatfactoModel, SplatfactoModelConfig
from nerfstudio.pipelines.base_pipeline import VanillaPipelineConfig
from nerfstudio.plugins.registry import MethodSpecification


# -- Depth loss ----------------------------------------------------------------


def pearson_depth_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """Scale-invariant depth loss via Pearson correlation.

    Returns 1 - |r| (convention-agnostic: handles both depth and disparity
    targets without requiring sign alignment). Invariant to scale and shift,
    so it works with relative (non-metric) monocular depth estimates.
    """
    p = pred.reshape(-1)
    t = target.reshape(-1)

    valid = (t > 0) & torch.isfinite(p) & torch.isfinite(t)
    if valid.sum() < 10:
        return torch.tensor(0.0, device=pred.device, requires_grad=True)

    p = p[valid]
    t = t[valid]
    p = p - p.mean()
    t = t - t.mean()

    p_std = torch.clamp(p.std(), min=1e-8)
    t_std = torch.clamp(t.std(), min=1e-8)

    r = (p * t).mean() / (p_std * t_std)
    return 1.0 - torch.abs(r)


# -- DataManager ---------------------------------------------------------------


@dataclass
class DepthFullImageDatamanagerConfig(FullImageDatamanagerConfig):
    _target: Type = field(default_factory=lambda: DepthFullImageDatamanager)
    depth_dir: str = ""
    """Path to directory of .npy depth maps (stems must match training image filenames)."""


class DepthFullImageDatamanager(FullImageDatamanager):
    config: DepthFullImageDatamanagerConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._depth_file_map: Dict[int, Path] = {}
        self._depth_ready = False

    def _ensure_depth_loaded(self):
        if self._depth_ready:
            return
        self._depth_ready = True

        if not self.config.depth_dir:
            return

        depth_dir = Path(self.config.depth_dir)
        if not depth_dir.exists():
            print(f"[depth-splatfacto] Warning: depth directory not found: {depth_dir}")
            return

        image_filenames = self.train_dataset._dataparser_outputs.image_filenames

        for idx, img_path in enumerate(image_filenames):
            depth_path = depth_dir / f"{img_path.stem}.npy"
            if depth_path.exists():
                self._depth_file_map[idx] = depth_path

        print(
            f"[depth-splatfacto] Depth maps: "
            f"{len(self._depth_file_map)}/{len(image_filenames)} images matched"
        )

    def next_train(self, step: int):
        self._ensure_depth_loaded()
        camera, batch = super().next_train(step)

        idx = batch["image_idx"]
        if hasattr(idx, "item"):
            idx = idx.item()
        else:
            idx = int(idx)

        if idx in self._depth_file_map:
            depth_np = np.load(self._depth_file_map[idx])
            depth_tensor = torch.from_numpy(depth_np).float()
            if depth_tensor.dim() == 2:
                depth_tensor = depth_tensor.unsqueeze(-1)
            batch["depth_gt"] = depth_tensor

        return camera, batch


# -- Model ---------------------------------------------------------------------


@dataclass
class DepthSplatfactoModelConfig(SplatfactoModelConfig):
    _target: Type = field(default_factory=lambda: DepthSplatfactoModel)
    depth_loss_mult: float = 0.1
    """Starting weight for monocular depth supervision loss. 0 disables depth loss."""
    depth_loss_mult_final: float = -1.0
    """Final depth loss weight at end of training. Set to -1 to use constant
    depth_loss_mult throughout. When >= 0, the weight linearly anneals from
    depth_loss_mult to depth_loss_mult_final over max_num_iterations."""
    depth_anneal_steps: int = 0
    """Number of steps over which to anneal depth weight. 0 defaults to
    stop_split_at (end of densification), which is the natural transition
    point between geometry formation and appearance refinement."""


class DepthSplatfactoModel(SplatfactoModel):
    config: DepthSplatfactoModelConfig

    def populate_modules(self):
        if self.config.depth_loss_mult > 0:
            self.config.output_depth_during_training = True
        super().populate_modules()

    def _get_depth_weight(self, step: int) -> float:
        if self.config.depth_loss_mult_final < 0:
            return self.config.depth_loss_mult

        total = self.config.depth_anneal_steps
        if total <= 0:
            total = self.config.stop_split_at
        t = min(step / max(total, 1), 1.0)
        start = self.config.depth_loss_mult
        end = self.config.depth_loss_mult_final
        return start + (end - start) * t

    def get_loss_dict(
        self, outputs, batch, metrics_dict=None
    ) -> Dict[str, torch.Tensor]:
        loss_dict = super().get_loss_dict(outputs, batch, metrics_dict)

        if (
            self.config.depth_loss_mult > 0
            and outputs.get("depth") is not None
            and "depth_gt" in batch
        ):
            weight = self._get_depth_weight(self.step)
            if weight > 0:
                depth_pred = outputs["depth"]
                depth_gt = batch["depth_gt"].to(depth_pred.device)

                if depth_gt.shape[:2] != depth_pred.shape[:2]:
                    depth_gt = (
                        F.interpolate(
                            depth_gt.permute(2, 0, 1).unsqueeze(0),
                            size=depth_pred.shape[:2],
                            mode="bilinear",
                            align_corners=False,
                        )
                        .squeeze(0)
                        .permute(1, 2, 0)
                    )

                loss_dict["depth_loss"] = weight * pearson_depth_loss(
                    depth_pred, depth_gt
                )

        return loss_dict


# -- Method registration -------------------------------------------------------

_trainer_config = TrainerConfig(
    method_name="depth-splatfacto",
    max_num_iterations=30000,
    pipeline=VanillaPipelineConfig(
        datamanager=DepthFullImageDatamanagerConfig(
            dataparser=ColmapDataParserConfig(),
        ),
        model=DepthSplatfactoModelConfig(),
    ),
    optimizers={
        "means": {
            "optimizer": AdamOptimizerConfig(lr=1.6e-4, eps=1e-15),
            "scheduler": ExponentialDecaySchedulerConfig(
                lr_final=1.6e-6, max_steps=30000
            ),
        },
        "features_dc": {
            "optimizer": AdamOptimizerConfig(lr=0.0025, eps=1e-15),
            "scheduler": None,
        },
        "features_rest": {
            "optimizer": AdamOptimizerConfig(lr=0.0025 / 20, eps=1e-15),
            "scheduler": None,
        },
        "opacities": {
            "optimizer": AdamOptimizerConfig(lr=0.05, eps=1e-15),
            "scheduler": None,
        },
        "scales": {
            "optimizer": AdamOptimizerConfig(lr=0.005, eps=1e-15),
            "scheduler": None,
        },
        "quats": {
            "optimizer": AdamOptimizerConfig(lr=0.001, eps=1e-15),
            "scheduler": None,
        },
    },
)

depth_splatfacto_method = MethodSpecification(
    config=_trainer_config,
    description="Splatfacto with monocular depth supervision via Pearson correlation loss.",
)
