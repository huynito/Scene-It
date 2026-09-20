import type { InteropScene } from "./export-interop";
import { toUnity } from "./export-interop";

export interface UnityExportData {
  fps: number;
  duration: number;
  camera: {
    frames: Array<{
      time: number;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      fov: number;
    }>;
  };
  anchors: Array<{
    id: string;
    label: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    width: number;
    height: number;
    appearAt: number | null;
    disappearAt: number | null;
  }>;
}

export function generateUnityJson(
  scene: InteropScene,
  includeCamera: boolean,
  includeAnchors: boolean,
): string {
  const { camera, anchors } = toUnity(scene);

  const data: UnityExportData = {
    fps: scene.fps,
    duration: scene.duration,
    camera: {
      frames: includeCamera
        ? camera.map((f) => ({
            time: f.time,
            position: f.position,
            rotation: { x: f.rotation.pitch, y: f.rotation.yaw, z: f.rotation.roll },
            fov: f.fov,
          }))
        : [],
    },
    anchors: includeAnchors
      ? anchors.map((a) => ({
          id: a.id,
          label: a.label,
          position: a.position,
          rotation: a.rotation,
          scale: a.scale,
          width: a.width,
          height: a.height,
          appearAt: a.appearAt,
          disappearAt: a.disappearAt,
        }))
      : [],
  };

  return JSON.stringify(data, null, 2);
}

export const UNITY_IMPORTER_SCRIPT = `using UnityEngine;
using UnityEditor;
using System.IO;

[System.Serializable]
public class GSVFrame
{
    public float time;
    public Vector3 position;
    public Vector3 rotation;
    public float fov;
}

[System.Serializable]
public class GSVCamera
{
    public GSVFrame[] frames;
}

[System.Serializable]
public class GSVAnchor
{
    public string id;
    public string label;
    public Vector3 position;
    public Vector3 rotation;
    public float scale;
    public float width;
    public float height;
    public float appearAt;
    public float disappearAt;
}

[System.Serializable]
public class GSVSceneData
{
    public float fps;
    public float duration;
    public GSVCamera camera;
    public GSVAnchor[] anchors;
}

public class GSVImporter : EditorWindow
{
    [MenuItem("Tools/GSV Importer")]
    static void ShowWindow()
    {
        GetWindow<GSVImporter>("GSV Importer");
    }

    void OnGUI()
    {
        GUILayout.Label("Scene It Importer", EditorStyles.boldLabel);
        if (GUILayout.Button("Import GSV JSON"))
        {
            string path = EditorUtility.OpenFilePanel("Select GSV JSON", "", "json");
            if (!string.IsNullOrEmpty(path))
            {
                ImportScene(path);
            }
        }
    }

    void ImportScene(string path)
    {
        string json = File.ReadAllText(path);
        GSVSceneData data = JsonUtility.FromJson<GSVSceneData>(json);

        if (data.camera != null && data.camera.frames != null && data.camera.frames.Length > 0)
        {
            GameObject camObj = new GameObject("GSV Camera");
            Camera cam = camObj.AddComponent<Camera>();
            cam.fieldOfView = data.camera.frames[0].fov;

            AnimationClip clip = new AnimationClip();
            clip.frameRate = data.fps;

            AnimationCurve posX = new AnimationCurve();
            AnimationCurve posY = new AnimationCurve();
            AnimationCurve posZ = new AnimationCurve();
            AnimationCurve rotX = new AnimationCurve();
            AnimationCurve rotY = new AnimationCurve();
            AnimationCurve rotZ = new AnimationCurve();
            AnimationCurve fovCurve = new AnimationCurve();

            foreach (var f in data.camera.frames)
            {
                posX.AddKey(f.time, f.position.x);
                posY.AddKey(f.time, f.position.y);
                posZ.AddKey(f.time, f.position.z);
                rotX.AddKey(f.time, f.rotation.x);
                rotY.AddKey(f.time, f.rotation.y);
                rotZ.AddKey(f.time, f.rotation.z);
                fovCurve.AddKey(f.time, f.fov);
            }

            clip.SetCurve("", typeof(Transform), "localPosition.x", posX);
            clip.SetCurve("", typeof(Transform), "localPosition.y", posY);
            clip.SetCurve("", typeof(Transform), "localPosition.z", posZ);
            clip.SetCurve("", typeof(Transform), "localEulerAngles.x", rotX);
            clip.SetCurve("", typeof(Transform), "localEulerAngles.y", rotY);
            clip.SetCurve("", typeof(Transform), "localEulerAngles.z", rotZ);
            clip.SetCurve("", typeof(Camera), "field of view", fovCurve);

            string clipPath = "Assets/GSVCameraAnimation.anim";
            AssetDatabase.CreateAsset(clip, clipPath);

            Animation anim = camObj.AddComponent<Animation>();
            anim.AddClip(clip, "GSVCamera");
            anim.clip = clip;

            Debug.Log("GSV Camera imported with " + data.camera.frames.Length + " frames.");
        }

        if (data.anchors != null)
        {
            foreach (var a in data.anchors)
            {
                GameObject obj = new GameObject(a.label);
                obj.transform.position = a.position;
                obj.transform.eulerAngles = a.rotation;
                obj.transform.localScale = Vector3.one * a.scale;
                Debug.Log("GSV Anchor: " + a.label);
            }
        }

        AssetDatabase.Refresh();
        Debug.Log("GSV scene import complete.");
    }
}
`;
