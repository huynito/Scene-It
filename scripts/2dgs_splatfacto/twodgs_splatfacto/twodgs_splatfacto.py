"""
2D Gaussian Splatting with optional depth supervision for nerfstudio.

Uses gsplat's rasterization_2dgs() to render planar disc-shaped Gaussians
instead of 3D ellipsoids. The planar constraint prevents the geometric
distortions (waviness/denting) that 3DGS exhibits on flat reflective surfaces,
because discs can orient and scale in 2 axes but cannot deform out-of-plane.

Optionally adds monocular depth supervision (Pearson correlation loss with
annealing), ported from the depth-splatfacto extension.

Registers as '2dgs-splatfacto' with nerfstudio. Usage:

    # Pure 2DGS (no depth):
    ns-train 2dgs-splatfacto \
      --data /path/to/colmap_dataset \
      colmap --downscale-factor 1

    # 2DGS + annealed depth supervision:
    ns-train 2dgs-splatfacto \
      --pipeline.model.depth-loss-mult 0.1 \
      --pipeline.model.depth-loss-mult-final 0.0 \
      --pipeline.datamanager.depth-dir /path/to/depth \
      --data /path/to/colmap_dataset \
      colmap --downscale-factor 1
"""

import numpy as np
import torch
import torch.nn.functional as F
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple, Type, Union

from gsplat.rendering import rasterization_2dgs
from gsplat.strategy import DefaultStrategy
from torch.nn import Parameter

from nerfstudio.cameras.cameras import Cameras
from nerfstudio.data.datamanagers.full_images_datamanager import (
    FullImageDatamanager,
    FullImageDatamanagerConfig,
)
from nerfstudio.data.dataparsers.colmap_dataparser import ColmapDataParserConfig
from nerfstudio.engine.callbacks import (
    TrainingCallback,
    TrainingCallbackAttributes,
    TrainingCallbackLocation,
)
from nerfstudio.engine.optimizers import AdamOptimizerConfig
from nerfstudio.engine.schedulers import ExponentialDecaySchedulerConfig
from nerfstudio.engine.trainer import TrainerConfig
from nerfstudio.models.splatfacto import SplatfactoModel, SplatfactoModelConfig
from nerfstudio.pipelines.base_pipeline import VanillaPipelineConfig
from nerfstudio.plugins.registry import MethodSpecification


def _get_viewmat(optimized_camera_to_world):
    R = optimized_camera_to_world[:, :3, :3]
    T = optimized_camera_to_world[:, :3, 3:4]
    R = R * torch.tensor([[[1, -1, -1]]], device=R.device, dtype=R.dtype)
    R_inv = R.transpose(1, 2)
    T_inv = -torch.bmm(R_inv, T)
    viewmat = torch.zeros(R.shape[0], 4, 4, device=R.device, dtype=R.dtype)
    viewmat[:, 3, 3] = 1.0
    viewmat[:, :3, :3] = R_inv
    viewmat[:, :3, 3:4] = T_inv
    return viewmat


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
            print(f"[2dgs-splatfacto] Warning: depth directory not found: {depth_dir}")
            return

        image_filenames = self.train_dataset._dataparser_outputs.image_filenames

        for idx, img_path in enumerate(image_filenames):
            depth_path = depth_dir / f"{img_path.stem}.npy"
            if depth_path.exists():
                self._depth_file_map[idx] = depth_path

        print(
            f"[2dgs-splatfacto] Depth maps: "
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
class TwoDGSSplatfactoModelConfig(SplatfactoModelConfig):
    _target: Type = field(default_factory=lambda: TwoDGSSplatfactoModel)
    normal_consistency_weight: float = 0.0
    """Weight for normal consistency loss (rendered normals vs depth-derived normals).
    Set > 0 to encourage Gaussians to align with the actual surface geometry.
    Typical values: 0.01-0.1. Requires render_mode with depth (always enabled)."""
    distortion_weight: float = 0.0
    """Weight for distortion regularization loss. Reduces z-fighting and
    encourages Gaussians to form clean surfaces. Typical values: 0.0-100.0."""
    depth_loss_mult: float = 0.0
    """Starting weight for monocular depth supervision loss. 0 disables depth loss."""
    depth_loss_mult_final: float = -1.0
    """Final depth loss weight. Set to -1 for constant weight. When >= 0, the
    weight linearly anneals from depth_loss_mult to depth_loss_mult_final."""
    depth_anneal_steps: int = 0
    """Number of steps over which to anneal depth weight. 0 defaults to
    stop_split_at (end of densification)."""


class TwoDGSSplatfactoModel(SplatfactoModel):
    config: TwoDGSSplatfactoModelConfig

    def populate_modules(self):
        if self.config.depth_loss_mult > 0:
            self.config.output_depth_during_training = True
        super().populate_modules()
        self.strategy = DefaultStrategy(
            prune_opa=self.config.cull_alpha_thresh,
            grow_grad2d=self.config.densify_grad_thresh,
            grow_scale3d=self.config.densify_size_thresh,
            grow_scale2d=self.config.split_screen_size,
            prune_scale3d=self.config.cull_scale_thresh,
            prune_scale2d=self.config.cull_screen_size,
            refine_scale2d_stop_iter=self.config.stop_screen_size_at,
            refine_start_iter=self.config.warmup_length,
            refine_stop_iter=self.config.stop_split_at,
            reset_every=self.config.reset_alpha_every * self.config.refine_every,
            refine_every=self.config.refine_every,
            pause_refine_after_reset=self.num_train_data + self.config.refine_every,
            absgrad=False,
            revised_opacity=False,
            verbose=True,
            key_for_gradient="gradient_2dgs",
        )
        self.strategy_state = self.strategy.initialize_state(scene_scale=1.0)

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

    def get_outputs(self, camera: Cameras) -> Dict[str, Union[torch.Tensor, List]]:
        if not isinstance(camera, Cameras):
            print("Called get_outputs with not a camera")
            return {}

        if self.training:
            assert camera.shape[0] == 1, "Only one camera at a time"
            optimized_camera_to_world = self.camera_optimizer.apply_to_camera(camera)
        else:
            optimized_camera_to_world = camera.camera_to_worlds

        if self.crop_box is not None and not self.training:
            crop_ids = self.crop_box.within(self.means).squeeze()
            if crop_ids.sum() == 0:
                return self.get_empty_outputs(
                    int(camera.width.item()),
                    int(camera.height.item()),
                    self.background_color,
                )
        else:
            crop_ids = None

        if crop_ids is not None:
            opacities_crop = self.opacities[crop_ids]
            means_crop = self.means[crop_ids]
            features_dc_crop = self.features_dc[crop_ids]
            features_rest_crop = self.features_rest[crop_ids]
            scales_crop = self.scales[crop_ids]
            quats_crop = self.quats[crop_ids]
        else:
            opacities_crop = self.opacities
            means_crop = self.means
            features_dc_crop = self.features_dc
            features_rest_crop = self.features_rest
            scales_crop = self.scales
            quats_crop = self.quats

        colors_crop = torch.cat(
            (features_dc_crop[:, None, :], features_rest_crop), dim=1
        )

        camera_scale_fac = self._get_downscale_factor()
        camera.rescale_output_resolution(1 / camera_scale_fac)
        viewmat = _get_viewmat(optimized_camera_to_world)
        K = camera.get_intrinsics_matrices().cuda()
        W, H = int(camera.width.item()), int(camera.height.item())
        self.last_size = (H, W)
        camera.rescale_output_resolution(camera_scale_fac)

        render_mode = "RGB+ED"

        if self.config.sh_degree > 0:
            sh_degree_to_use = min(
                self.step // self.config.sh_degree_interval, self.config.sh_degree
            )
        else:
            colors_crop = torch.sigmoid(colors_crop).squeeze(1)
            sh_degree_to_use = None

        use_distloss = self.config.distortion_weight > 0

        (
            render,
            alpha,
            render_normals,
            surf_normals,
            render_distort,
            render_median,
            self.info,
        ) = rasterization_2dgs(
            means=means_crop,
            quats=quats_crop,
            scales=torch.exp(scales_crop),
            opacities=torch.sigmoid(opacities_crop).squeeze(-1),
            colors=colors_crop,
            viewmats=viewmat,
            Ks=K,
            width=W,
            height=H,
            packed=False,
            near_plane=0.01,
            far_plane=1e10,
            render_mode=render_mode,
            sh_degree=sh_degree_to_use,
            sparse_grad=False,
            absgrad=self.strategy.absgrad,
            distloss=use_distloss,
        )

        if self.training:
            self.strategy.step_pre_backward(
                self.gauss_params,
                self.optimizers,
                self.strategy_state,
                self.step,
                self.info,
            )

        alpha = alpha[:, ...]

        background = self._get_background_color()
        rgb = render[:, ..., :3] + (1 - alpha) * background
        rgb = torch.clamp(rgb, 0.0, 1.0)

        if self.config.use_bilateral_grid and self.training:
            if camera.metadata is not None and "cam_idx" in camera.metadata:
                rgb = self._apply_bilateral_grid(rgb, camera.metadata["cam_idx"], H, W)

        depth_im = render[:, ..., 3:4]
        depth_im = torch.where(
            alpha > 0, depth_im, depth_im.detach().max()
        ).squeeze(0)

        if background.shape[0] == 3 and not self.training:
            background = background.expand(H, W, 3)

        outputs = {
            "rgb": rgb.squeeze(0),
            "depth": depth_im,
            "accumulation": alpha.squeeze(0),
            "background": background,
        }

        if render_normals is not None:
            outputs["normals"] = render_normals.squeeze(0)
        if surf_normals is not None:
            outputs["surf_normals"] = surf_normals.squeeze(0)
        if render_distort is not None:
            outputs["distortion"] = render_distort.squeeze(0)

        return outputs

    def get_loss_dict(
        self, outputs, batch, metrics_dict=None
    ) -> Dict[str, torch.Tensor]:
        loss_dict = super().get_loss_dict(outputs, batch, metrics_dict)

        # Normal consistency loss
        if (
            self.config.normal_consistency_weight > 0
            and "normals" in outputs
            and "surf_normals" in outputs
            and outputs["surf_normals"] is not None
        ):
            normals_rendered = outputs["normals"]
            normals_surface = outputs["surf_normals"]
            normal_error = (1.0 - (normals_rendered * normals_surface).sum(dim=-1))
            normal_error = normal_error * outputs["accumulation"].squeeze(-1)
            loss_dict["normal_consistency"] = (
                self.config.normal_consistency_weight * normal_error.mean()
            )

        # Distortion loss
        if self.config.distortion_weight > 0 and "distortion" in outputs:
            loss_dict["distortion"] = (
                self.config.distortion_weight * outputs["distortion"].mean()
            )

        # Depth supervision loss
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
    method_name="2dgs-splatfacto",
    max_num_iterations=30000,
    pipeline=VanillaPipelineConfig(
        datamanager=DepthFullImageDatamanagerConfig(
            dataparser=ColmapDataParserConfig(),
        ),
        model=TwoDGSSplatfactoModelConfig(),
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

twodgs_splatfacto_method = MethodSpecification(
    config=_trainer_config,
    description="Splatfacto with 2D Gaussian Splatting (planar disc Gaussians) for improved flat surface quality.",
)
