"""
Cinema 4D Camera Animation Export Script

Run this inside Cinema 4D's Script Manager (Script > Script Manager).
Select a Camera object in the Object Manager, then execute.

Two export modes:
  1. Keyframed — preserves editable keyframes with bezier tangent data
  2. Baked     — samples every frame for maximum fidelity (captures dynamics,
                 expressions, constraints, etc.)

Output JSON is compatible with Scene It's import system.
"""

import c4d
import json
import os
import math

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────

EXPORT_MODE = "both"          # "keyframed", "baked", or "both"
BAKED_FPS = 30                # Frame rate for baked sampling
OUTPUT_DIR = ""               # Leave empty to use desktop
COORD_SCALE = 1.0             # Multiply all positions by this (e.g. 0.01 for cm→m)
FLIP_Z = True                 # C4D uses left-handed coords; flip Z for WebGL


def get_output_path(suffix):
    base = OUTPUT_DIR or os.path.join(os.path.expanduser("~"), "Desktop")
    cam_name = op.GetName().replace(" ", "_") if op else "camera"
    return os.path.join(base, f"{cam_name}_{suffix}.json")


def world_pos(obj, frame=None):
    """Get world-space position, optionally at a specific frame."""
    doc = c4d.documents.GetActiveDocument()
    if frame is not None:
        doc.SetTime(c4d.BaseTime(frame, doc.GetFps()))
        doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

    mg = obj.GetMg()
    p = mg.off * COORD_SCALE
    z = -p.z if FLIP_Z else p.z
    return {"x": round(p.x, 6), "y": round(p.y, 6), "z": round(z, 6)}


def world_rotation(obj, frame=None):
    """Get pitch/yaw from world matrix, optionally at a specific frame."""
    doc = c4d.documents.GetActiveDocument()
    if frame is not None:
        doc.SetTime(c4d.BaseTime(frame, doc.GetFps()))
        doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

    mg = obj.GetMg()
    hpb = c4d.utils.MatrixToHPB(mg, c4d.ROTATIONORDER_DEFAULT)

    yaw = hpb.x
    pitch = hpb.y
    if FLIP_Z:
        yaw = -yaw

    return {"pitch": round(pitch, 6), "yaw": round(yaw, 6)}


def get_fov(obj, frame=None):
    """Get vertical FOV in degrees."""
    doc = c4d.documents.GetActiveDocument()
    if frame is not None:
        doc.SetTime(c4d.BaseTime(frame, doc.GetFps()))
        doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

    focal = obj[c4d.CAMERA_FOCUS]
    sensor = obj[c4d.CAMERA_FILM_OFFSET_Y] * 2 if obj[c4d.CAMERA_FILM_OFFSET_Y] else 36.0
    sensor = 24.0
    fov_rad = 2.0 * math.atan(sensor / (2.0 * focal))
    return round(math.degrees(fov_rad), 4)


def get_track_keyframes(obj, desc_id):
    """Extract CTrack keyframes for a given description ID."""
    track = obj.FindCTrack(desc_id)
    if not track:
        return []
    curve = track.GetCurve()
    if not curve:
        return []

    result = []
    fps = c4d.documents.GetActiveDocument().GetFps()

    for i in range(curve.GetKeyCount()):
        key = curve.GetKey(i)
        time_sec = key.GetTime().Get()
        value = key.GetValue()

        left_time = key.GetTimeLeft().Get()
        left_value = key.GetValueLeft()
        right_time = key.GetTimeRight().Get()
        right_value = key.GetValueRight()

        result.append({
            "time": round(time_sec, 6),
            "value": round(value, 6),
            "leftTime": round(left_time, 6),
            "leftValue": round(left_value, 6),
            "rightTime": round(right_time, 6),
            "rightValue": round(right_value, 6),
            "interpolation": key.GetInterpolation(),
        })

    return result


def tangent_to_normalized(kf_prev_time, kf_time, kf_next_time, kf_value, kf_next_value,
                          left_time, left_value, right_time, right_value):
    """Convert C4D absolute tangent handles to normalized 0-1 bezier control points."""
    seg_duration = kf_next_time - kf_time
    value_range = kf_next_value - kf_value

    if seg_duration == 0:
        return (
            {"x": 1/3, "y": 1/3},
            {"x": 2/3, "y": 2/3},
        )

    out_x = min(max(right_time / seg_duration, 0), 1) if seg_duration != 0 else 1/3
    out_y = right_value / value_range if value_range != 0 else 1/3

    in_seg_duration = kf_time - kf_prev_time if kf_prev_time is not None else seg_duration
    in_x = min(max(1.0 + left_time / seg_duration, 0), 1) if seg_duration != 0 else 2/3
    in_y = 1.0 + (left_value / value_range) if value_range != 0 else 2/3

    return (
        {"x": round(min(max(out_x, 0), 1), 6), "y": round(out_y, 6)},
        {"x": round(min(max(in_x, 0), 1), 6), "y": round(in_y, 6)},
    )


# ──────────────────────────────────────────────────────────
# Keyframed export
# ──────────────────────────────────────────────────────────

def export_keyframed(cam):
    """Export camera animation as editable keyframes with bezier tangent data."""
    doc = c4d.documents.GetActiveDocument()
    fps = doc.GetFps()
    original_time = doc.GetTime()

    pos_x_keys = get_track_keyframes(cam, c4d.DescID(c4d.DescLevel(c4d.ID_BASEOBJECT_REL_POSITION, c4d.DTYPE_VECTOR, 0),
                                                       c4d.DescLevel(c4d.VECTOR_X, c4d.DTYPE_REAL, 0)))
    pos_y_keys = get_track_keyframes(cam, c4d.DescID(c4d.DescLevel(c4d.ID_BASEOBJECT_REL_POSITION, c4d.DTYPE_VECTOR, 0),
                                                       c4d.DescLevel(c4d.VECTOR_Y, c4d.DTYPE_REAL, 0)))
    pos_z_keys = get_track_keyframes(cam, c4d.DescID(c4d.DescLevel(c4d.ID_BASEOBJECT_REL_POSITION, c4d.DTYPE_VECTOR, 0),
                                                       c4d.DescLevel(c4d.VECTOR_Z, c4d.DTYPE_REAL, 0)))

    all_times = sorted(set(
        [k["time"] for k in pos_x_keys] +
        [k["time"] for k in pos_y_keys] +
        [k["time"] for k in pos_z_keys]
    ))

    if not all_times:
        print("No position keyframes found on camera.")
        return None

    min_time = all_times[0]
    keyframes = []

    for i, t in enumerate(all_times):
        pos = world_pos(cam, int(round(t * fps)))
        rot = world_rotation(cam, int(round(t * fps)))
        fov = get_fov(cam, int(round(t * fps)))

        kf = {
            "id": f"kf-c4d-{i}",
            "time": round(t - min_time, 6),
            "position": pos,
            "target": rot,
            "fov": fov,
            "easing": "linear",
            "curves": {},
        }

        channel_map = {
            "posX": pos_x_keys,
            "posY": pos_y_keys,
            "posZ": pos_z_keys,
        }

        for ch_name, ch_keys in channel_map.items():
            matching = [k for k in ch_keys if abs(k["time"] - t) < 0.0001]
            if matching:
                mk = matching[0]
                next_time = all_times[i + 1] if i + 1 < len(all_times) else t + 1
                prev_time = all_times[i - 1] if i > 0 else t
                next_val = mk["value"]

                next_matching = [k for k in ch_keys if abs(k["time"] - next_time) < 0.0001]
                if next_matching:
                    next_val = next_matching[0]["value"]

                out_t, in_t = tangent_to_normalized(
                    prev_time, t, next_time,
                    mk["value"], next_val,
                    mk["leftTime"], mk["leftValue"],
                    mk["rightTime"], mk["rightValue"]
                )
                kf["curves"][ch_name] = {
                    "outTangent": out_t,
                    "inTangent": in_t,
                }

        keyframes.append(kf)

    doc.SetTime(original_time)
    doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

    return {
        "id": f"path-c4d-{int(c4d.GeGetTimer())}",
        "name": cam.GetName(),
        "keyframes": keyframes,
        "loop": False,
        "splineMode": "linear",
    }


# ──────────────────────────────────────────────────────────
# Baked export
# ──────────────────────────────────────────────────────────

def export_baked(cam):
    """Export camera animation as per-frame samples."""
    doc = c4d.documents.GetActiveDocument()
    fps = doc.GetFps()
    original_time = doc.GetTime()

    start_frame = doc.GetMinTime().GetFrame(fps)
    end_frame = doc.GetMaxTime().GetFrame(fps)

    sample_interval = max(1, int(round(fps / BAKED_FPS)))
    frames = []

    for frame in range(start_frame, end_frame + 1, sample_interval):
        time_sec = frame / float(fps)
        pos = world_pos(cam, frame)
        rot = world_rotation(cam, frame)
        fov = get_fov(cam, frame)

        frames.append({
            "time": round(time_sec - (start_frame / float(fps)), 6),
            "position": pos,
            "rotation": rot,
            "fov": fov,
        })

    doc.SetTime(original_time)
    doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

    return {
        "id": f"baked-c4d-{int(c4d.GeGetTimer())}",
        "name": f"{cam.GetName()} (baked)",
        "fps": BAKED_FPS,
        "frames": frames,
        "loop": False,
    }


# ──────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────

def main():
    doc = c4d.documents.GetActiveDocument()
    cam = doc.GetActiveObject()

    if not cam or not cam.IsInstanceOf(c4d.Ocamera):
        print("Please select a Camera object in the Object Manager.")
        c4d.gui.MessageDialog("Please select a Camera object first.")
        return

    print(f"Exporting camera: {cam.GetName()}")

    if EXPORT_MODE in ("keyframed", "both"):
        data = export_keyframed(cam)
        if data:
            path = get_output_path("keyframed")
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
            print(f"Keyframed export saved to: {path}")

    if EXPORT_MODE in ("baked", "both"):
        data = export_baked(cam)
        if data:
            path = get_output_path("baked")
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
            print(f"Baked export saved to: {path}")

    c4d.gui.MessageDialog(f"Camera export complete!\nFiles saved to: {OUTPUT_DIR or '~/Desktop'}")


if __name__ == "__main__":
    main()
