# Nerfstudio Splatfacto Training — Reference & Log

## Machine Profiles

Each machine has different base paths. Update the **Active Machine** marker and use the corresponding paths in the workflow below.

### WSL - Desktop (Active)

**GPU:** RTX 5080 | **nerfstudio:** 1.1.5 | **gsplat:** 1.4.0 (pinned -- 1.5.x changes rasterization/densification behavior)

**Required before training:**
```bash
export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH
```

| Scene | Base Path |
|-------|-----------|
| LivingRoom | `/mnt/c/Users/bhuynh22/Documents/GaussianSplat/LivingRoom` |
| Kitchen | `/mnt/c/Users/bhuynh22/Documents/GaussianSplat/Kitchen` |

Derived paths from base: `{base}/renders/{scene}`, `{base}/sparse/{scene}/sparse/0`, `{base}/colmap/{scene}/`, `{base}/nerfstudio_outputs/`, `{base}/export/{scene}/`

### WSL - Previous (D: drive, retired)

| Scene | Base Path |
|-------|-----------|
| LivingRoom | `/mnt/d/Cinema 4D Projects/GaussianSplat/LivingRoom` |

---

## Training Workflow

All commands assume WSL with the active machine profile. Set these variables first:

```bash
BASE="/mnt/c/Users/bhuynh22/Documents/GaussianSplat/LivingRoom"
SCENE="MinNight_24"
```

### Step 1: Clean previous training artifacts

```bash
rm -rf "$BASE/colmap/$SCENE/"
rm -rf "$BASE/export/$SCENE/"
rm -rf "$BASE/nerfstudio_outputs/$SCENE/"
```

### Step 2: Verify point count

```bash
wc -l "$BASE/sparse/$SCENE/sparse/0/points3D.txt"
```

### Step 3: Create training structure

```bash
mkdir -p "$BASE/colmap/$SCENE/colmap/sparse/0"
mkdir -p "$BASE/colmap/$SCENE/colmap/images"
```

### Step 4: Copy COLMAP files

```bash
cp "$BASE/sparse/$SCENE/sparse/0/"* \
   "$BASE/colmap/$SCENE/colmap/sparse/0/"
```

### Step 5: Fix image names in images.txt

```bash
sed -i 's/_\([A-Za-z]*\)_\([0-9]\{4\}\.png\)/\1\2/g' \
  "$BASE/colmap/$SCENE/colmap/sparse/0/images.txt"
```

For scene-specific fixes (e.g., removing `_Fix` from Kitchen image names):
```bash
sed -i 's/_Fix//g' "$BASE/colmap/$SCENE/colmap/sparse/0/images.txt"
```

### Step 6: Copy renders

```bash
cp "$BASE/renders/$SCENE/"* \
   "$BASE/colmap/$SCENE/colmap/images/"
```

### Step 7: Create images symlink

```bash
ln -s "$BASE/colmap/$SCENE/colmap/images" \
      "$BASE/colmap/$SCENE/images"
```

### Step 8: Train

**Living Room (current best):**

```bash
cd ~
conda activate nerfstudio

export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH && \
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
ns-train splatfacto \
  --vis tensorboard \
  --output-dir "$BASE/nerfstudio_outputs/" \
  --experiment-name $SCENE \
  --data "$BASE/colmap/$SCENE/" \
  --max-num-iterations 30000 \
  --pipeline.datamanager.camera-res-scale-factor 1.0 \
  --pipeline.model.num-downscales 1 \
  --pipeline.model.rasterize-mode antialiased \
  --pipeline.model.use-absgrad True \
  --pipeline.model.densify-grad-thresh 0.0004 \
  --pipeline.model.stop-split-at 20000 \
  --pipeline.model.cull-alpha-thresh 0.15 \
  colmap \
  --downscale-factor 1
```

**Kitchen (current best -- without depth supervision):**

```bash
cd ~
conda activate nerfstudio

export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH && \
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
ns-train splatfacto \
  --vis tensorboard \
  --output-dir "$BASE/nerfstudio_outputs/" \
  --experiment-name $SCENE \
  --data "$BASE/colmap/$SCENE/" \
  --max-num-iterations 30000 \
  --pipeline.datamanager.camera-res-scale-factor 1.0 \
  --pipeline.model.num-downscales 1 \
  --pipeline.model.rasterize-mode antialiased \
  --pipeline.model.use-absgrad True \
  --pipeline.model.densify-grad-thresh 0.0004 \
  --pipeline.model.stop-split-at 20000 \
  --pipeline.model.use-scale-regularization True \
  --pipeline.model.max-gauss-ratio 50 \
  colmap \
  --downscale-factor 1
```

**Living Room + annealed depth supervision (requires `nerfstudio-depth` env with depth-splatfacto v0.2.0):**

```bash
cd ~
conda activate nerfstudio-depth

export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH && \
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
ns-train depth-splatfacto \
  --vis tensorboard \
  --output-dir "$BASE/nerfstudio_outputs/" \
  --experiment-name "${SCENE}_depth_annealed" \
  --data "$BASE/colmap/$SCENE/" \
  --max-num-iterations 40000 \
  --pipeline.datamanager.depth-dir "$BASE/colmap/$SCENE/depth" \
  --pipeline.model.depth-loss-mult 0.1 \
  --pipeline.model.depth-loss-mult-final 0.0 \
  --pipeline.datamanager.camera-res-scale-factor 1.0 \
  --pipeline.model.num-downscales 1 \
  --pipeline.model.rasterize-mode antialiased \
  --pipeline.model.use-absgrad True \
  --pipeline.model.densify-grad-thresh 0.0004 \
  --pipeline.model.stop-split-at 20000 \
  --pipeline.model.cull-alpha-thresh 0.15 \
  colmap \
  --downscale-factor 1
```

**Note:** Living Room does NOT use scale regularization (causes wall/floor holes) and keeps `densify-grad-thresh 0.0004` (0.0002 causes floater explosion with sweep cameras). SH degree stays at default (3).

**Prerequisite:** Generate depth maps first (one-time): `python scripts/generate_depth_maps.py "$BASE/colmap/$SCENE" --model large`

**Kitchen + annealed depth supervision (recommended -- requires `nerfstudio-depth` env with depth-splatfacto v0.2.0):**

```bash
cd ~
conda activate nerfstudio-depth

export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH && \
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
ns-train depth-splatfacto \
  --vis tensorboard \
  --output-dir "$BASE/nerfstudio_outputs/" \
  --experiment-name "${SCENE}_depth_annealed" \
  --data "$BASE/colmap/$SCENE/" \
  --max-num-iterations 40000 \
  --pipeline.datamanager.depth-dir "$BASE/colmap/$SCENE/depth" \
  --pipeline.model.depth-loss-mult 0.1 \
  --pipeline.model.depth-loss-mult-final 0.0 \
  --pipeline.datamanager.camera-res-scale-factor 1.0 \
  --pipeline.model.num-downscales 1 \
  --pipeline.model.rasterize-mode antialiased \
  --pipeline.model.use-absgrad True \
  --pipeline.model.densify-grad-thresh 0.0002 \
  --pipeline.model.stop-split-at 20000 \
  --pipeline.model.use-scale-regularization True \
  --pipeline.model.max-gauss-ratio 50 \
  --pipeline.model.sh-degree 2 \
  colmap \
  --downscale-factor 1
```

**Note:** Depth annealing ramps the depth weight from 0.1 to 0.0 linearly over the first 20k iterations (densification phase). The remaining 20k iterations run with zero depth constraint, giving SH full freedom for appearance refinement. This gives geometric guidance early (fixes cupboard corner) without the late-stage depth-vs-SH conflict that worsened metallic surfaces in constant-depth runs.

**Prerequisite:** Generate depth maps first (one-time): `python scripts/generate_depth_maps.py "$BASE/colmap/$SCENE" --model large`

**Setup:** `pip install scripts/depth_splatfacto/ --force-reinstall --no-deps` in the `nerfstudio-depth` conda env.

### Step 9: Export

```bash
mkdir -p "$BASE/export/$SCENE/"

ns-export gaussian-splat \
  --load-config "$(ls -t $BASE/nerfstudio_outputs/$SCENE/splatfacto/*/config.yml | head -1)" \
  --output-dir "$BASE/export/$SCENE/"
```

**Note:** Update the path to match the actual method and experiment name used during training. For depth-splatfacto runs:
```bash
ns-export gaussian-splat \
  --load-config "$(ls -t $BASE/nerfstudio_outputs/${SCENE}_depth_annealed/depth-splatfacto/*/config.yml | head -1)" \
  --output-dir "$BASE/export/$SCENE/"
```

**PyTorch 2.6 export fix:** If `ns-export` fails with `weights_only` / `UnpicklingError` about numpy types, PyTorch 2.6 changed the default for `torch.load`. Use this wrapper instead:
```bash
python -c "
import torch, numpy as np
torch.serialization.add_safe_globals([
    np.core.multiarray.scalar, np.dtype,
    np.dtypes.Float64DType, np.dtypes.Float32DType,
    np.dtypes.Int64DType, np.dtypes.Int32DType,
    np.ndarray, np.float64, np.float32, np.int64, np.int32,
])
from nerfstudio.scripts.exporter import entrypoint
import sys
sys.argv = ['ns-export', 'gaussian-splat',
  '--load-config', '$(ls -t $BASE/nerfstudio_outputs/${SCENE}_depth_annealed/depth-splatfacto/*/config.yml | head -1)',
  '--output-dir', '$BASE/export/$SCENE/']
entrypoint()
"
```

---

## Proven Settings

Empirically validated across multiple training runs on room-scale C4D scenes.

| Setting | Value | Why |
|---------|-------|-----|
| `num-downscales` | `1` | Winner over default (2) and 0. Fewer coarse initial Gaussians. 0 is too aggressive (noisy early Gaussians cause blurring). |
| `densify-grad-thresh` | `0.0004` recommended | 2x more aggressive than default (0.0008). Fills in detail through more splitting. Safe with sweep and perpendicular coverage. `0.0002` causes multiplicative Gaussian growth with additional cameras (sweeps and perpendicular coverage). Kitchen confirmed acceptable quality at `0.0004` with significantly smaller PLY files. |
| `cull-alpha-thresh` | `0.15` | Raised from default 0.1. More aggressively culls semi-transparent Gaussians. Marginal impact in testing but no downside. |
| `stop-split-at` | `20000` | Extended from default 15000. Gives 5000 more iterations of densification to fill surface gaps. Increases Gaussian count. |
| `rasterize-mode` | `antialiased` | Significantly better sharpness and texture detail vs classic. Slightly worsens wall holes but compensated by aggressive densification. |
| `--vis tensorboard` | -- | Viser web viewer crashes training on RTX 5080 machine, even after completion, causing lost progress. Tensorboard is safer. |
| `CUDA_HOME` export | `/usr/local/cuda` | Required for gsplat JIT compilation on Blackwell GPUs (RTX 5080). Without it, gsplat fails with "No CUDA toolkit found." |
| gsplat version | `1.4.0` | Pinned. 1.5.x changes rasterization and densification behavior. |
| Focal length | 24mm standardized | Mixed focal lengths cause floaters, haze, and blurring. Previously used 36mm. 24mm provides good coverage without excessive warping. |
| Initial points | ~4M via `uniform_point_sampler.py` | Confirmed baseline for room-scale scenes. 6M and 7M tested: largely equivalent quality but no benefit. 7M introduced new small floaters. Stick with 4M. |

---

## Scene-Specific Flags

Some flags help one scene but hurt another. Use per-scene training commands.

### Scale Regularization

| Setting | Kitchen | Living Room |
|---------|---------|-------------|
| `use-scale-regularization` | `True` | `False` |
| `max-gauss-ratio` | `50` | N/A |

**Kitchen:** Perpendicular sweep coverage provides strong wall constraint, so scale regularization is safe. `max-gauss-ratio 50` reduced needle/scratch artifacts on wood cupboard doors. Tightening to 20 showed no additional visual improvement, just smaller PLY file.

**Living Room:** Scale regularization creates transparent holes on walls/floors. These scenes rely on elongated pancake-shaped Gaussians for surface coverage.

### SH Degree

Default is 3. Reducing helps with file size but has limited visual impact:

| sh-degree | Effect | File size impact |
|-----------|--------|-----------------|
| 3 (default) | Full view-dependent color | Largest (48 coefficients/Gaussian) |
| 2 | Slightly reduced view-dependence | ~35% smaller per Gaussian |
| 1 | Minimal view-dependence, more matte look | ~75% smaller per Gaussian |

Tested sh-degree 2 and 1 on Kitchen. Neither improved metallic artifacts. SH degree 2 and 1 slightly degrade metallic surface quality (optimizer compensates for reduced SH capacity with more geometric distortion). Keep SH 3 for scenes with metallic/reflective objects.

---

## Scene-Specific Findings

### Living Room (MinNight_24)

**Camera setup:** 640 base circular rig + ~600 sweep/perpendicular/detail cameras = ~1240 total (1300 with latest additions)

**Pain points:**

- **Tight gaps behind furniture (couch + chair):** Gaps are now filled with detail cameras, but textures were smeared/smoothed. Root cause identified: wrong material applied to blanket in additional coverage renders (~100 frames) vs correct material in base rig (~600 frames). Optimizer averaged the two textures. Fix: re-render additional coverage with correct materials + improved angles less extreme close to the couch.
- **Wall floaters when hugging walls:** Upper and lower portions of walls still lift/float when the camera gets close. Middle band is reasonable quality thanks to centered perpendicular sweep. Multi-height perpendicular sweeps (high/low) added but only marginal improvement. Resistant to camera coverage solutions -- likely a fundamental limitation at close viewing distance.
- **Hallway zone:** Narrow space with additional corner bend and dimmer lighting makes coverage difficult. Latest training produced the cleanest hallway result yet. Needs dedicated rig at hallway-center distance; deprioritized since viewer only passes through entrance.

**Next steps:** Re-render additional coverage with correct blanket material + improved couch angles (in progress).

### Kitchen (Kitchen_24)

**Camera setup:** Perpendicular + +/-45 degree sweeps + targeted perpendicular coverage for metallic objects. Scale regularization safe here due to strong wall constraint from sweeps.

**Pain points:**

- **Trash can (resolved):** Waviness/denting on metallic surface. Fixed by adding targeted perpendicular cameras for visible faces + manually culling ~24 renders viewing from extreme angles. Validates coverage strategy as the fix for freestanding metallic objects.
- **Fridge (resolved):** Waviness from the left-side diagonal viewing angle. Fixed by adding surface detail in C4D (fridge magnets, calendar, post-it notes) + additional camera coverage specifically from the problematic diagonal direction. The surface detail gives the optimizer texture anchors that reduce per-Gaussian SH ambiguity on the otherwise featureless specular surface, while the targeted coverage ensures adequate training signal from the viewing angle that was previously under-covered. Previously exhausted without improvement: perpendicular coverage + culling, material swap, plane projection, neighbor smoothing, 2DGS (planar disc Gaussians), 2DGS + depth supervision, training flags (SH degree, scale reg). The "confirmed SH limitation" diagnosis was partially incorrect -- the artifact was a combination of featureless specular surface AND insufficient coverage from the specific problematic angle, not purely an SH representation issue.
- **Wood surface scratches (cupboard doors):** Needle Gaussians. Reduced by `use-scale-regularization True` + `max-gauss-ratio 50`.
- **Staircase peek view:** Quality gap due to dim lighting and angled corner bend (similar geometry challenge to living room hallway). Low priority.
- **Light caustics through blinds, cupboard wall drift near plant:** Minor, addressable via SuperSplat cleanup.

**Current best config:** `depth-splatfacto` with annealed depth (0.1→0.0), `densify-grad-thresh 0.0004`, `scale-reg`, 4M initial points, SH degree 3 (keeps metallic surfaces cleaner than 2 or 1).

---

## Confirmed Harmful Settings

Do NOT use these. Validated through testing.

| Setting | Result |
|---------|--------|
| `--pipeline.model.num-downscales 0` | Noisy early Gaussians cause blurring |
| `--pipeline.model.reset-alpha-every 15` | Black voids |
| `--pipeline.model.reset-alpha-every 25` | Ghosting and smearing |
| Mixed camera focal lengths | Floaters, haze, blurring across entire scene |
| `--vis viewer` (Viser) on RTX 5080 | Crashes training, lost progress |
| `--vis none` | Not a valid option in current nerfstudio version |
| Sweep cameras + `densify-grad-thresh 0.0002` | Multiplicative Gaussian growth, severe floaters, degraded quality in previously clean areas. `0.0004` with sweeps is safe. |

---

## Camera Coverage Strategy

### Core Principles

**Focal length:** Standardized at 24mm. Mixed focal lengths are confirmed harmful.

**Distance consistency:** Match camera distance to the viewer's actual experience. Don't add close-up cameras to fix detail -- the distance mismatch creates worse artifacts than the detail gap.

**Camera count balance:** More cameras is not always better. Too many cameras combined with aggressive densification (`densify-grad-thresh 0.0002`) causes multiplicative Gaussian growth, adding floaters and degrading previously clean areas.

### Coverage Types

**Base rig (circular):**
- Single camera on circular spline rig pointed at room center
- Full revolutions at multiple heights
- Revolutions with camera tilting up/down for angled coverage
- Provides good broad coverage for roughly square rooms

**Wall coverage:**
- Perpendicular cameras facing walls directly are highest value (strongest depth signal for surface constraint, 3-5 per wall at different heights)
- Single-height perpendicular sweep only constrains a horizontal band of the wall; multi-height sweeps (high, center, low) needed for full vertical coverage, though improvement is marginal
- +/-45 degree sweeps provide good triangulation for COLMAP but weak surface constraint -- walls viewed obliquely have less per-pixel coverage and depth errors are invisible
- Sweep coverage is safe at `densify-grad-thresh 0.0004` but causes floater explosion at `0.0002`

**Detail zones:**
- Hallway, furniture gaps, kitchen island paths need dedicated rigs at the natural viewing distance for that space
- Don't push cameras into tight gaps -- instead add angled-down views from standing distance
- Under-furniture coverage only needed if viewer paths go to seated/low height
- Objects flush against walls have occluded contact points -- accept some artifacts there
- Close-up camera passes over furniture (e.g., circular rig passing directly over couch) cause texture blending between adjacent surfaces -- remove or replace with consistent-distance alternatives

### Target-Specific Camera Analysis (`scripts/colmap_target_analysis.py`)

Analyzes which training cameras view a specific target object and from what angles. Designed for reducing SH reflection conflicts on metallic/specular surfaces by selectively culling cameras that view the target from extreme angles.

**Prerequisites:** numpy (available in the system Python at `/Library/Developer/CommandLineTools/usr/bin/python3`).

**Analyze which cameras view the target:**
```bash
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/colmap_target_analysis.py \
  analyze /path/to/colmap_dataset --target cx,cy,cz --list
```

Outputs an azimuth histogram (8 compass sectors) showing the angular distribution of cameras around the target, plus per-camera details when `--list` is used. Save the camera list to CSV with `--save-list cameras.csv` for manual review.

**Cull cameras viewing the target from specific angles:**
```bash
# Keep only cameras viewing the target from 90-270 degree azimuth (dry run first)
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/colmap_target_analysis.py \
  cull /path/to/colmap_dataset --target cx,cy,cz --keep-azimuth 90,270 --dry-run --list

# Exclude cameras viewing the target from 0-90 and 270-360 azimuth range
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/colmap_target_analysis.py \
  cull /path/to/colmap_dataset --target cx,cy,cz --exclude-azimuth 315,45 --output /path/to/output

# Exclude specific cameras from a manually curated list
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/colmap_target_analysis.py \
  cull /path/to/colmap_dataset --target cx,cy,cz --exclude-list cameras_to_remove.txt
```

Cameras NOT viewing the target are always kept -- only cameras pointed at the target from excluded angles are removed. Depth maps are automatically copied if present. Output is a full COLMAP dataset directory ready for nerfstudio training.

**Flags:**
- `--target cx,cy,cz` -- approximate 3D center of the target object (use `ply_smooth.py inspect`/`slice` to find coordinates)
- `--fov-half` -- half-angle of camera FOV in degrees (default: 37, matching 24mm full-frame)
- `--up-axis` -- scene up axis for azimuth computation (`y` or `z`, default: `y`)
- `--keep-azimuth lo,hi` / `--exclude-azimuth lo,hi` -- azimuth range in degrees, wraps at 360
- `--exclude-list` -- file with image names to exclude (one per line, or CSV from `--save-list`)

**Workflow for metallic surface improvement:**
1. Get approximate target coordinates via `ply_smooth.py inspect`/`slice` or SuperSplat
2. Run `analyze --list` to see which cameras view the target and from what azimuths
3. Identify the azimuth range that corresponds to the viewer path (the "good" angles)
4. Run `cull --dry-run` with `--keep-azimuth` to preview what would be removed
5. Run `cull` to create the filtered dataset
6. Add 3-5 targeted perpendicular cameras per visible face in C4D at natural walking distance
7. Integrate new cameras into the culled dataset and retrain

### Findings

- Kitchen scene: perpendicular + +/-45 degree sweeps worked well. Sweep cameras at consistent distance from walls.
- Living room scene: sweep coverage at `densify-grad-thresh 0.0004` is safe and improves hallway quality without floater explosion. At `0.0002`, the same sweeps caused severe floaters and quality regression.
- Hallway: needs dedicated rig at hallway-center distance, not the main room rig distance. Dimmer lighting is a separate challenge but deprioritized since viewer only passes through the entrance.

---

## Known Artifacts and Limitations

### Fixable via Training Flags

| Artifact | Cause | Fix |
|----------|-------|-----|
| Wall holes (transparent gaps on flat surfaces) | Insufficient Gaussian coverage | `densify-grad-thresh 0.0004` + `stop-split-at 20000`, keep `use-scale-regularization False`. Living Room requires `0.0004` with sweep cameras; Kitchen tolerated `0.0002` with sweeps but not yet re-verified. |
| Needle/scratch artifacts on wood surfaces | Extremely elongated Gaussians | `use-scale-regularization True` + `max-gauss-ratio 50` (Kitchen only -- causes wall holes in Living Room) |
| Aliasing/shimmer | Small Gaussians at varying distances | `rasterize-mode antialiased` |

### Fixable via Camera Coverage

| Artifact | Cause | Fix |
|----------|-------|-----|
| Surface drift (Gaussians floating slightly off surface) | Insufficient perpendicular view constraint | Add 2-3 cameras directly facing the affected surface |
| Detail gaps in narrow spaces | No coverage at natural viewing distance | Dedicated rig at appropriate distance for that zone |
| Texture blending/smearing (e.g., blanket merging with couch) | Material inconsistency across render batches (wrong material applied in additional coverage) or close-up distance mismatch | Verify material consistency across all render batches; replace extreme close-up frames with consistent-distance alternatives |
| Metallic surface waviness/denting (freestanding objects) | Too many cameras viewing the object from different angles, creating conflicting SH reflection signals | Add targeted perpendicular cameras for the visible faces only + cull images that view the object from extreme/peripheral angles. Use `sync_images_txt.py` after deleting images. |

### Fixable via Post-Processing

| Artifact | Cause | Fix |
|----------|-------|-----|
| SH ghosts (translucent copies of objects floating in space) | SH exploiting view-dependent color to "fake" reflections | SuperSplat manual selection and delete |
| Isolated floaters (blobs in open space) | Optimizer artifacts | SuperSplat manual cleanup, or `ply_cleanup.py --min-opacity 0.01` |

### Metallic Surface Artifacts (Partially Addressable via Coverage Strategy)

The "fundamental SH limitation" framing was **partially incorrect**. The stove hood in the Kitchen scene uses the same metallic material as the trash can and fridge but renders cleanly. This proves SH CAN handle metallic surfaces when the right conditions are met. The key differentiator is **viewing angle diversity**: the stove hood is wall-mounted and seen from a narrow angular range, while the trash can sits in open space and is viewed from many directions with wildly different reflections.

**Root cause:** When cameras see very different reflections on a surface from different angles, SH can't reconcile the conflicting color data. The optimizer distorts Gaussian geometry (positions, scales, orientations) to approximate the view-dependent appearance, producing waviness/denting on what should be smooth surfaces. The artifacts are a coherent optimizer solution -- positions, scales, rotations, and SH coefficients are all coupled -- not isolated positional noise that can be fixed in post-processing.

**What works:** Targeted perpendicular camera coverage for the visible faces of the object + manual culling of training images that view the object from extreme/peripheral angles. This reduces the angular diversity of reflections that SH needs to reconcile. Validated on the trash can (fully resolved). Use `sync_images_txt.py` after manually deleting images to update `images.txt`.

**What also works (discovered later):** For large flat metallic surfaces (fridge), adding surface detail in C4D (magnets, calendar, post-it notes) to break up the featureless specular surface + targeted camera coverage from the specific problematic viewing angle. The surface detail provides texture anchors that reduce per-Gaussian SH ambiguity, while the targeted coverage ensures the optimizer has adequate training signal from the angle that matters. Previously failed approaches (coverage alone, post-processing, material swaps, 2DGS) didn't work because they addressed geometry or coverage individually -- the fix required both texture anchors AND angle-specific coverage simultaneously.

**What was tried and failed (before the coverage strategy fix):**

| Approach | Result |
|----------|--------|
| sh-degree 1, 2, 3 | No improvement. Lower SH capacity causes optimizer to compensate by deforming geometry instead. |
| scale-regularization 20, 50 | No improvement on metallic surfaces (helped wood scratches). |
| Constant depth supervision (0.05, 0.1) | No improvement on metals. Depth loss fights SH, worsening denting. Also introduced ceiling corner artifacts. |
| Annealed depth supervision (0.1→0.0 over 20k) | Fridge slightly improved. Trash can unchanged. Best approach for overall scene quality but doesn't solve the trash can. |
| Post-processing: neighbor-based position smoothing (`ply_smooth.py --mode neighbor`) | No improvement. Waviness is baked into Gaussian shapes/orientations, not just positions. |
| Post-processing: plane-fit projection (`ply_smooth.py --mode plane`) | Destructive. Bounding box imprecision caused cross-object contamination. |
| Post-processing: SH zeroing (`--zero-sh`) | Made appearance worse (flat/wrong colors) without fixing geometry. |
| PLY merge (swap trash can region from older run) | Failed. Gaussians from different training runs have incompatible characteristics (different positions, scales, SH). Visual discontinuity at boundaries. |
| Less specular C4D materials (re-rendered) | Some improvement on fridge, not sufficient for trash can. |
| Additional camera coverage (general) | Did not target trash can specifically. |

**Key insight for future scenes:** Metallic/reflective objects that are visible from a narrow, consistent angular range (wall-mounted, recessed, behind glass) will render well. Objects in open space viewed from many angles (floor-standing, freestanding) are the problematic case. The fix is coverage strategy: add targeted perpendicular cameras from the actual viewer path direction, and cull images that view the object from extreme angles. Training parameters alone cannot solve this.

### Other Non-Fixable Artifacts

| Artifact | Cause | Notes |
|----------|-------|-------|
| Light caustic artifacts (e.g., light through blinds) | Optimizer creates floating Gaussians to approximate projected light patterns | Manual SuperSplat cleanup or accept |

---

## Post-Processing

### PLY Cleanup (`scripts/ply_cleanup.py`)

Filters Gaussians from exported PLY files. Run on Mac from project root:

```bash
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_cleanup.py <input.ply> \
  -o <output.ply> --min-opacity 0.01 --stats --dry-run
```

**Safe thresholds for room-scale scenes:**
- `--min-opacity 0.005` to `0.01` -- Removes ~0.2% of Gaussians. Safe, minimal visual impact.

**Too aggressive for room-scale scenes:**
- `--max-scale-sigma 3.0` -- Removes large structural Gaussians (walls, ceiling, floor). Destroys scene.
- `--isolation-k 3` -- Removes 11%+ of Gaussians including ceiling, floor, and distant walls. Collapses scene bounds.

Always run with `--dry-run` first to check removal percentages before committing.

### SuperSplat Manual Cleanup

Best for targeted removal of specific artifacts:
- SH ghosts, isolated floaters, light caustic artifacts
- Work in Centers Mode for precision selection
- Delete incrementally, check from multiple angles
- Cannot fix mispositioned surface Gaussians (deleting leaves holes)

### PLY Merge (`scripts/ply_merge.py`)

Combines regions from different training runs. Supports `--bbox`, `--sphere`, `--exclude-bbox`, `--exclude-sphere`, and `--region all` selection modes.

```bash
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_merge.py -o merged.ply \
  --input base_run.ply --exclude-sphere="cx,cy,cz,r" \
  --input detail_run.ply --sphere="cx,cy,cz,r" \
  --dedupe 0.001
```

**Tested on Kitchen scene (2026-03-20):** Attempted to swap the trash can region between training runs. **Did not work** -- Gaussians from different runs have incompatible positions/scales/SH, creating visual discontinuities at boundaries. PLY merge is only viable for large, low-detail regions (walls, floors) where boundary mismatches are less visible, not for swapping individual objects.

### PLY Smooth (`scripts/ply_smooth.py`)

Position smoothing and plane-fitting for Gaussian Splat PLY files. Three commands:

- `inspect` -- prints scene bounds and coordinate histograms (useful for locating objects)
- `slice` -- exports a region as a separate PLY for verification in SuperSplat
- `smooth` -- smooths Gaussian positions within a region

```bash
# Inspect scene coordinates
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py inspect input.ply

# Export a region for visual verification
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py slice input.ply --bbox="x0,y0,z0,x1,y1,z1" -o slice.ply

# Neighbor-based smoothing (safer, default)
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py smooth input.ply --bbox="x0,y0,z0,x1,y1,z1" --mode neighbor --iterations 3 --strength 0.3 -o smoothed.ply

# Plane-fit projection (requires precise selection)
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py smooth input.ply --bbox="x0,y0,z0,x1,y1,z1" --mode plane --planes 3 --dry-run

# Normal-filtered plane projection (isolates a single surface from a mixed bounding box)
/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py slice input.ply \
  --bbox="x0,y0,z0,x1,y1,z1" --normal-dir "dx,dy,dz" --normal-angle 30 -o face_check.ply

/Library/Developer/CommandLineTools/usr/bin/python3 scripts/ply_smooth.py smooth input.ply \
  --bbox="x0,y0,z0,x1,y1,z1" --mode plane \
  --normal-dir "dx,dy,dz" --normal-angle 30 --dry-run
```

**Normal filtering (added 2026-03-20):** Computes each Gaussian's surface normal from its rotation quaternion and scales (the thinnest axis of the ellipsoid points perpendicular to the surface). `--normal-dir dx,dy,dz` keeps only Gaussians whose normal aligns with the specified direction within `--normal-angle` degrees. This solves the cross-object contamination problem that made earlier plane-fit attempts destructive -- the bounding box can be loose since the normal filter excludes countertops, islands, walls, etc. Use `slice` with `--normal-dir` first to verify the selection in SuperSplat before applying smoothing.

**Tested on Kitchen trash can (2026-03-20):** Without normal filtering, neither neighbor smoothing nor plane-fit projection improved the metallic surface waviness -- bounding box imprecision caused cross-object contamination. The `--zero-sh` flag strips view-dependent color but makes appearance worse. The `inspect` and `slice` commands are useful for locating objects in PLY coordinate space.

### Monocular Depth Map Generation (`scripts/generate_depth_maps.py`)

Generates relative depth maps from existing training images using Depth Anything V2. These can be used as geometric supervision during training (depth loss) to constrain Gaussians onto surfaces -- particularly useful in tight corners or geometrically constrained spaces where RGB-only photometric loss produces positional ambiguity.

**Prerequisites:**
```bash
pip install torch torchvision transformers pillow numpy
```

**Usage (run from project root, or any machine with the images accessible):**
```bash
python scripts/generate_depth_maps.py /path/to/colmap_dataset --model large --dry-run
python scripts/generate_depth_maps.py /path/to/colmap_dataset --model large
```

**Example for Kitchen scene (WSL):**
```bash
python scripts/generate_depth_maps.py "$BASE/colmap/$SCENE" --model large
```

This creates a `depth/` directory alongside `images/` with matching `.npy` files. The script:
- Auto-detects GPU (CUDA/MPS) or falls back to CPU
- Skips already-generated depth maps (safe to restart)
- Outputs relative (not metric) depth -- compatible with scale-invariant depth losses

**Using with DN-Splatter:** After generating depth maps, train with DN-Splatter in the `nerfstudio-depth` conda env. See Depth Supervision Investigation section below for setup and training commands.

**Note:** `depth-loss-mult` does NOT exist in splatfacto in any nerfstudio version. Depth supervision for Gaussian splatting requires DN-Splatter (a third-party nerfstudio method).

---

## Depth Supervision Investigation

### Rationale

All training to date uses **purely RGB photometric loss** -- zero geometric supervision. Depth supervision constrains where Gaussians are placed in 3D space by penalizing deviations from estimated surface depth. This is particularly valuable for:
- Tight corners with limited viewing angle diversity (e.g., cupboard corner near plant)
- Areas where Gaussians drift off surfaces despite adequate camera coverage
- Geometrically constrained spaces where the optimizer cannot resolve positional ambiguity from RGB alone

### Approach: Monocular Depth Estimation

Rather than rendering ground truth depth from C4D (which requires going back to the rendering pipeline), monocular depth estimation models like Depth Anything V2 generate high-quality relative depth from single RGB images. These models perform especially well on clean, noise-free synthetic renders.

The depth maps are relative (not metric) but this is handled by nerfstudio's scale-invariant depth loss formulation.

### Version Check Result

**nerfstudio 1.1.5** -- `depth-loss-mult` is NOT available in splatfacto. The only depth-related splatfacto flags are:
- `--pipeline.model.output-depth-during-training` (controls depth output, not depth loss)
- `--viewer.default-composite-depth` (viewer display only)

### Finding: Splatfacto Does NOT Support Depth Supervision

Verified that `depth-loss-mult` does not exist in splatfacto in **any** nerfstudio version. nerfstudio 1.1.5 IS the latest version on PyPI, and its only depth-related splatfacto flags are:
- `--pipeline.model.output-depth-during-training` (output only)
- `--viewer.default-composite-depth` (viewer display)

Depth supervision is available in nerfstudio's NeRF models (nerfacto, depth-nerfacto) but not in the Gaussian splatting model.

### Path Forward: depth-splatfacto (Custom Nerfstudio Extension)

Since nerfstudio's splatfacto doesn't support depth supervision and third-party packages (DN-Splatter) have incompatible version requirements, a custom nerfstudio extension adds depth loss directly to splatfacto. Located at `scripts/depth_splatfacto/`.

**What it does:**
- Subclasses `SplatfactoModel` and adds a Pearson correlation depth loss (1 - |r|, convention-agnostic, scale-invariant)
- Supports **depth loss annealing**: weight linearly ramps from `depth-loss-mult` to `depth-loss-mult-final` over the densification phase, giving early geometric guidance without interfering with later SH appearance refinement
- Custom `FullImageDatamanager` that loads `.npy` depth maps alongside training images
- Registers as `depth-splatfacto` model with nerfstudio -- all splatfacto CLI flags still work
- Uses nerfstudio's data pipeline (streams images from disk -- handles 1-2k images without OOM)
- Outputs identical PLY files (same splatfacto export pipeline)

**Setup (in the `nerfstudio-depth` conda env):**
```bash
conda activate nerfstudio-depth
pip install scripts/depth_splatfacto/ --force-reinstall --no-deps
ns-train depth-splatfacto --help
```

**Training with annealed depth supervision (recommended):**
```bash
# 1. Generate depth maps from existing renders (one-time)
pip install transformers
python scripts/generate_depth_maps.py "$BASE/colmap/$SCENE" --model large

# 2. Train with annealed depth supervision (0.1 -> 0.0 over densification)
export CUDA_HOME=/usr/local/cuda && export PATH=$CUDA_HOME/bin:$PATH && \
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
ns-train depth-splatfacto \
  --vis tensorboard \
  --output-dir "$BASE/nerfstudio_outputs/" \
  --experiment-name "${SCENE}_depth" \
  --data "$BASE/colmap/$SCENE/" \
  --max-num-iterations 30000 \
  --pipeline.datamanager.depth-dir "$BASE/colmap/$SCENE/depth" \
  --pipeline.model.depth-loss-mult 0.1 \
  --pipeline.model.depth-loss-mult-final 0.0 \
  --pipeline.datamanager.camera-res-scale-factor 1.0 \
  --pipeline.model.num-downscales 1 \
  --pipeline.model.rasterize-mode antialiased \
  --pipeline.model.use-absgrad True \
  --pipeline.model.densify-grad-thresh 0.0002 \
  --pipeline.model.stop-split-at 20000 \
  --pipeline.model.use-scale-regularization True \
  --pipeline.model.max-gauss-ratio 50 \
  --pipeline.model.sh-degree 2 \
  colmap \
  --downscale-factor 1
```

**Depth loss annealing flags:**
- `depth-loss-mult` -- Starting depth weight (default `0.1`)
- `depth-loss-mult-final` -- Final depth weight. Set to `0.0` to anneal to zero. Set to `-1` (default) for constant weight throughout training
- `depth-anneal-steps` -- Steps over which to anneal. Default `0` uses `stop-split-at` (end of densification), which is the natural transition between geometry formation and appearance refinement

**Rationale for annealing:** Constant depth supervision conflicts with SH color optimization on view-dependent surfaces (metallic objects, reflective materials). The depth loss pulls Gaussians toward surfaces while SH pushes them off-surface to encode view-dependent reflections, causing geometric distortion. Annealing to zero during the densification phase gives Gaussians early geometric guidance, then lets the appearance refinement phase proceed without depth interference. The stove hood (clean metallic result) demonstrates that SH CAN handle metallic surfaces when Gaussians are well-positioned -- annealing provides that initial positioning without the late-stage conflict.

**Tuning:**
- Start weight `0.1` with final `0.0` for annealed training
- For constant depth (no annealing): `0.05` worked well for general scenes; `0.1` over-constrains ceiling corners
- `depth-anneal-steps 15000` anneals faster (over default densification window); `20000` matches extended `stop-split-at`
- `0.0` starting weight disables depth loss entirely (equivalent to standard splatfacto)

**Status:** Extension v0.2.0 with annealing support. Installed in `nerfstudio-depth` conda env. Depth maps generated for Kitchen (1278 images). Reinstall on WSL required to pick up v0.2.0.

### Depth Supervision Experiment Plan

With depth supervision changing the optimization dynamics, several parameters are worth A/B testing -- especially those that affect file size (184MB Living Room scene causes slight viewer sluggishness).

**File size drivers ranked by impact:**
1. `densify-grad-thresh` -- controls total Gaussian count (biggest lever)
2. `sh-degree` -- controls per-Gaussian storage cost (3→2 is ~35% smaller, 2→1 is another ~50%)
3. `stop-split-at` -- controls how long densification runs
4. `cull-alpha-thresh` -- controls how many low-opacity Gaussians survive

**Run 1 -- Baseline + depth (control):** Current Kitchen best + `depth-loss-mult 0.1`
Isolates the depth supervision effect with nothing else changed.

**Run 2 -- Lighter densification + depth:** `densify-grad-thresh 0.0004` (from 0.0002), depth 0.1
Tests whether depth supervision compensates for less aggressive densification. Should produce significantly fewer Gaussians (smaller PLY). Living Room uses 0.0004 successfully.

**Run 3 -- Minimal SH + depth:** `sh-degree 1`, depth 0.1
Maximum per-Gaussian file size reduction. Previously tested sh-degree 1 without depth -- "largely same visual results." With depth constraining geometry, sh-degree 1 should be even more viable.

**Run 4 -- Drop scale-reg + depth:** Remove `use-scale-regularization` and `max-gauss-ratio`, depth 0.1
Scale-reg was added for wood surface needle artifacts. Depth supervision may handle this naturally by constraining Gaussians to surfaces. Removing it simplifies the config and lets the optimizer use elongated Gaussians for surface coverage.

**Evaluation for each run:**
- Cupboard corner quality (primary target)
- Overall scene quality vs baseline (regression check)
- Gaussian count and PLY file size
- Metallic surface artifacts (not expected to improve but worth checking)

---

## 2D Gaussian Splatting Investigation

### Rationale

Two motivations: (1) the Kitchen fridge surface waviness, where all 3DGS approaches were exhausted, and (2) the Living Room wall floaters and ceiling corner cobweb artifacts, which are geometry accuracy problems that 2DGS's planar constraint was expected to address.

2DGS uses flat planar disc-shaped Gaussians instead of 3D ellipsoids. The planar constraint physically prevents geometric distortions (waviness/denting) because discs can orient and scale in 2 axes but cannot deform out-of-plane. For flat surfaces this is a strong geometric prior.

### Feasibility (Verified 2026-03-21)

- gsplat 1.4.0 has `rasterization_2dgs()` as a first-class function with full 2DGS support
- nerfstudio 1.1.5 does NOT have a native 2DGS model (only `splatfacto`)
- gsplat's `DefaultStrategy` supports 2DGS via `key_for_gradient="gradient_2dgs"`
- 2DGS uses the same input tensor shapes as 3DGS: means [N,3], quats [N,4], scales [N,3]
- The third scale in 2DGS represents surfel thickness (optimizer drives it small); PLY export is compatible with standard 3DGS viewers

### Approach: Custom `2dgs-splatfacto` Extension

Located at `scripts/2dgs_splatfacto/`. Subclasses `SplatfactoModel` and overrides `get_outputs()` to call `rasterization_2dgs()` instead of `rasterization()`. Configures `DefaultStrategy` with `key_for_gradient="gradient_2dgs"` for 2DGS-specific densification.

**Additional features:**
- `normal-consistency-weight` -- penalizes misalignment between rendered normals and depth-derived normals (values 0.01-0.1)
- `distortion-weight` -- reduces z-fighting and encourages clean surface formation
- Built-in depth supervision (same as depth-splatfacto) -- `depth-loss-mult`, `depth-loss-mult-final`, `depth-anneal-steps`

**Important limitations:**
- `rasterize-mode antialiased` is NOT supported by 2DGS rasterization -- must be omitted. This causes noticeable texture smoothing/loss of sharpness compared to antialiased 3DGS.
- Uses `absgrad=False` in the densification strategy (2DGS uses `gradient_2dgs` which provides regular `.grad`, not `.absgrad`). May require lower `densify-grad-thresh` to compensate.

**Setup (in either `nerfstudio` or `nerfstudio-depth` conda env):**
```bash
pip install scripts/2dgs_splatfacto/ --force-reinstall --no-deps
ns-train 2dgs-splatfacto --help
```

### Results (2026-03-21) -- Investigation Closed

Tested on both Kitchen and Living Room scenes. **2DGS does not improve either scene's primary artifacts.**

**Kitchen (4 runs):**

| Run | Fridge diagonal | Cupboard corner | File size | Notes |
|-----|----------------|-----------------|-----------|-------|
| 2DGS, culled imageset, densify 0.0004 | Same warping, slightly transparent | N/A (culled set) | 131MB | Culled imageset confounded results |
| 2DGS, original imageset, densify 0.0002 | Slightly less transparent, same warping | Floaters returned slightly | -- | Clean baseline comparison |
| 2DGS + depth annealed 0.1→0.0, 40k | Same warping | Clean (depth fixed it) | 143MB | Depth supervision recovers cupboard fix |

**Living Room (1 run):**

| Run | Wall floaters | Ceiling cobwebs | Textures | Notes |
|-----|--------------|-----------------|----------|-------|
| 2DGS, densify 0.0004, no depth | Not improved | Not significantly improved | Smoothed/lost detail | Texture regression from no antialiased mode |

**Conclusions:**
- **Fridge waviness is confirmed as an SH color limitation, not a geometry problem.** Planar disc Gaussians lie flat on the surface correctly, but SH still can't reconcile conflicting reflections from different viewing angles. The warping persists regardless of Gaussian shape.
- **Living Room wall floaters and ceiling cobwebs are not addressed by 2DGS planar constraint.** These may be positional placement errors or SH ghosts rather than geometric distortion of individual Gaussians.
- **2DGS loses antialiased rendering**, causing noticeable texture smoothing. This is a significant quality regression for both scenes.
- **2DGS produces smaller PLY files** (131-143MB vs 177MB for 3DGS+depth) due to more efficient surface coverage from planar discs.
- **2DGS + depth supervision works** -- the depth loss successfully combines with 2DGS rasterization, recovering the cupboard corner fix. But it doesn't add value over 3DGS + depth.
- **Best configs remain 3DGS-based:** Kitchen uses `depth-splatfacto` with annealed depth; Living Room uses standard `splatfacto` with antialiased rasterization.

**Kitchen fridge (subsequently resolved):** After closing the 2DGS investigation, the fridge was fixed by combining surface detail in C4D (magnets, calendar, post-it notes) with additional camera coverage from the specific problematic diagonal viewing angle. 2DGS correctly identified the artifact as not purely geometric, but the "confirmed SH limitation" diagnosis was incomplete -- the root cause was a featureless specular surface combined with insufficient coverage from the problematic angle. Adding texture anchors + targeted coverage resolved it within the standard 3DGS+depth pipeline.

---

## Position LR Scheduler Note

The position (`means`) learning rate scheduler has `max_steps=30000` hardcoded:

```
lr: 0.00016 → lr_final: 0.0000016 over 30000 steps (cosine ramp)
```

After 30k iterations, position LR stays at `lr_final` (100x slower than start). Positions can still move, just very slowly. Previously attributed to over-smoothing/smearing at >30k iterations, but that may have been caused by mixed focal lengths (which have since been fixed).

**Action:** When scaling to 40k-80k iterations, verify that PSNR/SSIM continue improving past 30k. If they plateau hard at 30k, increase `max_steps` to match `max-num-iterations`.

---

## Training Log

| Date | Scene | Iterations | Key Flags | Gaussians | Observations |
|------|-------|-----------|-----------|-----------|--------------|
| 2026-03-07 | MinNight_24 | 30000 | `antialiased`, `densify 0.0004` | ~2M | Good detail, some wall holes. Baseline for A/B test. |
| 2026-03-07 | MinNight_24 | 30000 | `classic`, `densify 0.0004` | -- | A/B test: slightly better wall coverage, significantly worse sharpness/detail. |
| 2026-03-07 | MinNight_24 | 30000 | `antialiased`, `densify 0.0002`, `stop-split 20000` | ~2M (500MB) | Best detail yet. 3x file size from aggressive densification. Some wall holes remain. SH ghost of plant near ceiling (removed in SuperSplat). |
| 2026-03-07 | MinNight_24 | 30000 | `antialiased`, `densify 0.0002`, `stop-split 20000`, + sweep coverage | -- | Added perpendicular + angled sweep cameras. Severe quality regression -- added floaters, worse detail in main room. `densify 0.0002` + sweep cameras = multiplicative Gaussian growth. |
| 2026-03-07 | Kitchen | 30000 | `antialiased`, `densify 0.0002`, `stop-split 20000`, `scale-reg`, `ratio 50`, `sh-degree 2` | ~1.08M | Good overall. Scale reg helped cupboard door scratches. Metallic surfaces (fridge, coffee machine, trash bin) still have waviness/scratches. Light caustic artifacts through blinds. Cupboard wall drift near plant. |
| 2026-03-07 | Kitchen | 30000 | `antialiased`, `densify 0.0002`, `stop-split 20000`, `scale-reg`, `ratio 20`, `sh-degree 1` | ~1.09M | Largely same visual results. Smaller PLY file from fewer SH coefficients. Metallic artifacts unchanged. Confirmed SH limitation, not fixable via flags. |
| 2026-03-08 | MinNight_24 | 30000 | `densify 0.0004`, sweep coverage, no antialiased | -- | Clean result, no floaters. Confirmed `0.0004` safe with sweep cameras. Wall floaters persist when hugging walls. |
| 2026-03-08 | MinNight_24 | 30000 | `antialiased`, `densify 0.0004`, `stop-split 20000`, `cull-alpha 0.15`, sweep coverage | -- | Good detail, cleanest hallway ever. Wall floaters marginal improvement. Gap behind furniture filled but textures smeared. Blanket/couch texture blending (later identified as material mismatch in additional coverage renders). |
| 2026-03-08 | MinNight_24 | 30000 | same + 60 high/low perp + detail cameras (1300 total) | -- | Gap behind couch/chair fully filled. Detail still smeared. Wall floaters only marginal improvement from multi-height sweeps. |
| 2026-03-08 | MinNight_24 | 30000 | same flags, 7M points | -- | Largely equivalent to 4M. Introduced a few new small floaters that didn't exist before. Higher point count not beneficial. |
| _(earlier)_ | MinNight_24 | 30000 | `densify 0.0004` | -- | Was testing densification threshold; lost context from this session. |
| _(earlier)_ | MinNight24 | 30000 | baseline | -- | Had floaters and surface holes on walls. |
| _(earlier)_ | Various | 40k-80k | baseline | -- | Incremental improvements with more iterations. Smearing observed but likely from mixed focal lengths, not LR scheduler. |
| 2026-03-18 | Kitchen | 30000 | `depth-splatfacto`, `depth 0.1`, `densify 0.0002`, `scale-reg`, `ratio 50`, `sh-degree 2` (1-r loss) | -- | **FAILED.** Gaussian explosion. Depth convention mismatch: Depth Anything V2 outputs disparity (closer=higher), splatfacto renders distance (farther=higher). Pearson `1-r` loss actively fought RGB loss. |
| 2026-03-18 | Kitchen | 30000 | `depth-splatfacto`, `depth 0.1`, `densify 0.0002`, `scale-reg`, `ratio 50`, `sh-degree 2` (1-\|r\| loss) | 138MB | **Cupboard corner clean.** Depth supervision resolved the persistent blurry artifact. Metallic surface artifacts persist (expected SH limitation). New minor ceiling corner artifacts. PLY smaller than Living Room (138MB vs 184MB). |
| 2026-03-19 | Kitchen | 40000 | `depth-splatfacto`, `depth 0.05`, `densify 0.0002`, `scale-reg`, `ratio 50`, `sh-degree 2`, 40k iters | -- | **Best overall (pre-annealing).** Cupboard corner still clean at lower depth weight. Ceiling corner artifacts slightly reduced vs 0.1. Metallic surfaces (trash can, fridge) still have severe waviness/denting. Extra 10k iterations did not cause smearing (validates that earlier >30k smearing was from mixed focal lengths). |
| 2026-03-20 | Kitchen | 40000 | `depth-splatfacto` v0.2.0 annealed `depth 0.1→0.0` over 20k, `densify 0.0002`, `scale-reg`, `ratio 50`, `sh-degree 2` | ~1.1M (177MB) | **Best overall.** Annealed depth: 0.1→0.0 over densification phase. Cupboard corner still clean. Ceiling corners and wall quality significantly improved vs constant-depth. Fridge slightly improved (acceptable). Trash can unchanged. Larger file (177MB vs 138-140MB, ~1.1M vs ~880K Gaussians) from stronger early depth gradients. |
| 2026-03-20 | Kitchen | -- | Targeted perpendicular coverage + manual image culling | 263MB | **Trash can resolved.** Added perpendicular camera coverage for visible trash can faces, manually culled ~24 renders viewing it from extreme angles, synced `images.txt` via `sync_images_txt.py`. Acceptably clean metallic surface. Validates that coverage strategy (not training parameters) is the fix for freestanding metallic objects. File size increased significantly (263MB vs 177MB previous best). |
| 2026-03-20 | Kitchen | -- | Same + `densify 0.0004`, 4M points, SH 3 | -- | **Acceptable file size.** Switching from `densify 0.0002` to `0.0004` significantly reduced PLY size. 4M points equivalent to 6M. SH 3 keeps metallic surfaces cleaner than 2 or 1 (lower SH causes more geometric distortion). |
| 2026-03-20 | Kitchen | -- | Post-processing: normal-filtered plane projection + neighbor smoothing | -- | **Failed.** Both plane projection and neighbor smoothing with `--normal-dir` filtering on fridge front face. Plane projection was destructive (fridge has depth features -- handles, dispenser). Neighbor smoothing had no visible improvement. Confirms post-processing PLY files does not work for metallic surface artifacts. |
| 2026-03-21 | MinNight_24 | 40000 | `depth-splatfacto` v0.2.0 annealed `depth 0.1→0.0`, `densify 0.0004`, `cull-alpha 0.15` | -- | First Living Room depth supervision run. Fuzzier/smeared textures, new floaters vs best 3DGS. Second attempt with `densify 0.0002` caused entire window to become a massive floater -- depth maps unreliable around bright light/semi-transparent blinds. **Depth supervision does not help Living Room.** |
| 2026-03-21 | Kitchen | 30000 | `2dgs-splatfacto`, culled imageset, `densify 0.0004`, `scale-reg`, `ratio 50` | 131MB | **2DGS first test.** Fridge slightly less transparent but same warping. Overall very slightly worse than 3DGS best. Confounded by culled imageset (fridge-specific camera culling still active). |
| 2026-03-21 | Kitchen | 30000 | `2dgs-splatfacto`, original imageset, `densify 0.0002`, `scale-reg`, `ratio 50` | -- | **2DGS clean baseline.** Restored original imageset. Fridge slightly less transparent, same warping quality. Cupboard corner floaters returned slightly (no depth supervision). |
| 2026-03-21 | Kitchen | 40000 | `2dgs-splatfacto` + depth annealed `0.1→0.0`, original imageset, `densify 0.0002`, `scale-reg`, `ratio 50` | 143MB | **2DGS + depth.** Cupboard corner clean again (depth fixed it). Fridge unchanged. Smaller file than 3DGS+depth (143MB vs 177MB). No improvement over 3DGS+depth for any artifact. |
| 2026-03-21 | MinNight_24 | 30000 | `2dgs-splatfacto`, `densify 0.0004`, `cull-alpha 0.15`, no depth | -- | **2DGS Living Room.** Wall floaters not improved. Ceiling cobwebs not significantly improved. Textures smoothed out -- loss of antialiased rendering quality. No improvement over 3DGS antialiased. **2DGS investigation closed.** |
| 2026-03-22 | Kitchen | 30000 | `depth-splatfacto` annealed `0.1→0.0`, `densify 0.0004`, `scale-reg`, `ratio 50`, fridge surface detail + targeted diagonal coverage | -- | **Fridge resolved.** Added fridge magnets/calendar/post-its in C4D + ~15 additional renders from the problematic left-side diagonal angle. Significant improvement on the fridge surface -- warping greatly reduced from that viewing angle. The combination of texture anchors (breaking up featureless specular surface) and coverage from the specific problematic direction was the fix. |
