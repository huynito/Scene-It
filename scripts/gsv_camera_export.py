"""
Scene It — Cinema 4D Camera Export Script

Run this script in Cinema 4D's Script Manager (Extensions > Script Manager).
It reads the active camera's animation across the full timeline range,
converts C4D's coordinate system (left-handed Y-up) to GSV's (right-handed
Y-up), and saves a JSON file compatible with the "Import Path" feature.

Usage:
  1. Select the camera you want to export in the Object Manager.
  2. Set the timeline range to the desired export range.
  3. Run this script.
  4. Choose a save location for the .json file.
  5. In GSV, click "Import Path" and select the exported file.

The exported file uses the BakedCameraPath format (per-frame samples).
"""

import c4d
import json
import math
import os


def get_camera_fov_vertical(camera, doc):
    """Extract vertical FOV in degrees from a C4D camera."""
    bc = camera.GetDataInstance()
    focal_length = bc.GetFloat(c4d.CAMERA_FOCUS)
    sensor_size = bc.GetFloat(c4d.CAMERA_FILM_OFFSET_Y) * 2
    if sensor_size <= 0:
        # Default to 36mm x 24mm sensor (full frame), vertical = 24mm
        sensor_size = 24.0
    fov_rad = 2.0 * math.atan(sensor_size / (2.0 * focal_length))
    return math.degrees(fov_rad)


def hpb_to_pitch_yaw(h_deg, p_deg):
    """Convert C4D HPB (degrees) to GSV pitch/yaw (radians).

    C4D is left-handed Y-up:
      H (Heading) = rotation around Y axis
      P (Pitch)   = rotation around X axis
      B (Bank)    = rotation around Z axis (dropped — no roll in GSV)

    GSV is right-handed Y-up:
      yaw   = rotation around Y axis (negated to flip handedness)
      pitch = rotation around X axis (same direction)
    """
    yaw = -h_deg * (math.pi / 180.0)
    pitch = p_deg * (math.pi / 180.0)
    return pitch, yaw


def export_camera():
    camera = doc.GetActiveObject()
    if camera is None or not camera.CheckType(c4d.Ocamera):
        c4d.gui.MessageDialog(
            "Please select a Camera object in the Object Manager before running this script."
        )
        return

    fps = doc.GetFps()
    min_time = doc.GetLoopMinTime()
    max_time = doc.GetLoopMaxTime()
    min_frame = min_time.GetFrame(fps)
    max_frame = max_time.GetFrame(fps)

    if min_frame >= max_frame:
        min_frame = doc.GetMinTime().GetFrame(fps)
        max_frame = doc.GetMaxTime().GetFrame(fps)

    if min_frame >= max_frame:
        c4d.gui.MessageDialog("Timeline range is empty. Set a valid timeline range.")
        return

    frames = []

    for f in range(min_frame, max_frame + 1):
        time = c4d.BaseTime(f, fps)
        doc.SetTime(time)
        doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

        mg = camera.GetMg()
        pos = mg.off
        hpb = c4d.utils.MatrixToHPB(mg, c4d.ROTATIONORDER_HPB)

        h_deg = math.degrees(hpb.x)
        p_deg = math.degrees(hpb.y)

        pitch, yaw = hpb_to_pitch_yaw(h_deg, p_deg)

        fov = get_camera_fov_vertical(camera, doc)

        frames.append({
            "time": round((f - min_frame) / float(fps), 6),
            "position": {
                "x": round(pos.x, 6),
                "y": round(pos.y, 6),
                "z": round(-pos.z, 6),  # negate Z for RH conversion
            },
            "rotation": {
                "pitch": round(pitch, 6),
                "yaw": round(yaw, 6),
            },
            "fov": round(fov, 2),
        })

    duration = (max_frame - min_frame) / float(fps)

    baked_path = {
        "name": camera.GetName(),
        "fps": fps,
        "frames": frames,
        "loop": False,
    }

    # Prompt for save location
    save_path = c4d.storage.SaveDialog(
        title="Save GSV Camera Path",
        force_suffix="json",
    )
    if not save_path:
        return

    with open(save_path, "w") as f:
        json.dump(baked_path, f, indent=2)

    c4d.gui.MessageDialog(
        "Exported {frames} frames ({dur:.1f}s at {fps} fps) to:\n{path}".format(
            frames=len(frames),
            dur=duration,
            fps=fps,
            path=save_path,
        )
    )


if __name__ == "__main__":
    export_camera()
