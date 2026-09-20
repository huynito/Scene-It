import type { SplatRenderer, Vec3, SceneInfo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CORNER_SEGMENTS = 8;

function buildRoundedRectGeometry(
  width: number,
  height: number,
  cornerRadius: number
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(cornerRadius, hw, hh);

  if (r <= 0.001) {
    return {
      positions: [-hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      // V is flipped (1-v) so that WebGL's bottom-left origin aligns with
      // the image's top-left origin without needing UNPACK_FLIP_Y_WEBGL.
      uvs: [0, 1, 1, 1, 1, 0, 0, 0],
      indices: [0, 1, 2, 0, 2, 3],
    };
  }

  const positions: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  const corners = [
    { cx: hw - r, cy: hh - r, start: 0 },
    { cx: -(hw - r), cy: hh - r, start: Math.PI / 2 },
    { cx: -(hw - r), cy: -(hh - r), start: Math.PI },
    { cx: hw - r, cy: -(hh - r), start: (3 * Math.PI) / 2 },
  ];

  for (const { cx, cy, start } of corners) {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const angle = start + (i / CORNER_SEGMENTS) * (Math.PI / 2);
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      positions.push(px, py, 0);
      // V flipped so image appears right-side-up (WebGL vs HTML origin)
      uvs.push((px + hw) / width, 1 - (py + hh) / height);
    }
  }

  const edgeCount = (CORNER_SEGMENTS + 1) * 4;
  const normals: number[] = [];
  for (let i = 0; i <= edgeCount; i++) {
    normals.push(0, 0, 1);
  }

  const indices: number[] = [];
  for (let i = 1; i <= edgeCount; i++) {
    const next = i === edgeCount ? 1 : i + 1;
    indices.push(0, i, next);
  }

  return { positions, normals, uvs, indices };
}

export class PlayCanvasRenderer implements SplatRenderer {
  private pc: any = null;
  private app: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private cameraEntity: any = null;
  private cameraFrame: any = null;
  private splatEntity: any = null;
  private splatAsset: any = null;
  private gridEntity: any = null;
  private anchors: Map<string, {
    entity: any;
    material: any;
    color: [number, number, number, number];
    billboardMode: "none" | "full" | "y-axis";
    baseEulerX: number;
    baseEulerZ: number;
    baseWidth: number;
    baseHeight: number;
    cornerRadius: number;
    baseScale: number;
    leashed: boolean;
    leashDistance: number;
    leashOffset: { x: number; y: number; z: number };
    leashRotationOffset: { x: number; y: number; z: number };
    texture: any;
    hasMedia: boolean;
    videoEl?: HTMLVideoElement;
    videoCanvas?: HTMLCanvasElement;
    gifEl?: HTMLImageElement;
    gifCanvas?: HTMLCanvasElement;
    gifFrames?: ImageBitmap[];
    gifDurations?: number[];
    gifStartTime?: number;
    gifCurrentFrame?: number;
  }> = new Map();
  private anchorCounter = 0;
  private depthProxies: Map<string, { entity: any; wireframe: any; material: any }> =
    new Map();
  private depthProxyCounter = 0;
  private showProxyWireframes = false;
  private depthMeshEntity: any = null;
  private depthMeshBlobUrl: string | null = null;
  private depthMeshMaterial: any = null;
  private depthMeshDebugMaterial: any = null;
  private splatCenter: Vec3 = { x: 0, y: 0, z: 0 };
  private splatRadius = 10;
  private sceneYawDeg = 0;
  private savedFov = 60;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private blobUrl: string | null = null;
  private gizmoEntity: any = null;
  private captureState: {
    gizmoWasVisible: boolean;
    gridWasVisible: boolean;
    wireframesWereVisible: boolean;
    depthMeshWasDebug: boolean;
  } | null = null;
  onContextLost: (() => void) | null = null;
  private _contextLostHandler: ((e: Event) => void) | null = null;
  private _resizeRafId: number | null = null;
  private _pendingResize: { width: number; height: number } | null = null;

  private dimEntity: any = null;
  private blurEntity: any = null;
  private dimAmount = 0;
  private blurAmount = 0;
  private fovMaskEntity: any = null;
  private fovStrokeEntity: any = null;
  private fovEnabled = false;
  private fovStrokeVisible = true;
  private fovFeather = 0;
  private dofEntity: any = null;
  private dofActive = false;
  private dofDepthCamera: any = null;
  private dofDepthTexture: any = null;
  private dofDepthRT: any = null;
  private dofDepthLayerId = -1;
  private dofDepthEntity: any = null;
  // Custom render layers: scene → gsv-dim → gsv-anchors → gsv-fov → gsv-fov-stroke
  private dimLayerId = -1;
  private anchorLayerId = -1;
  private fovLayerId = -1;
  private fovStrokeLayerId = -1;

  private applyViewportCanvasStyle(): void {
    if (!this.canvas) return;
    // Keep layout anchored to the viewport container even when PlayCanvas
    // updates inline width/height during resize calls.
    this.canvas.style.setProperty("position", "absolute");
    this.canvas.style.setProperty("top", "0");
    this.canvas.style.setProperty("left", "0");
    this.canvas.style.setProperty("display", "block");
    this.canvas.style.setProperty("width", "100%", "important");
    this.canvas.style.setProperty("height", "100%", "important");
  }

  async init(container: HTMLElement): Promise<void> {
    const pc = await import("playcanvas");
    this.pc = pc;
    this.container = container;

    this.canvas = document.createElement("canvas");
    this.applyViewportCanvasStyle();
    container.appendChild(this.canvas);

    const device = await pc.createGraphicsDevice(this.canvas, {
      deviceTypes: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    } as any);

    device.maxPixelRatio = window.devicePixelRatio;


    const appOptions = new pc.AppOptions();
    appOptions.graphicsDevice = device;
    appOptions.componentSystems = [
      pc.RenderComponentSystem,
      pc.CameraComponentSystem,
      pc.LightComponentSystem,
    ];
    appOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

    if (pc.GSplatComponentSystem) {
      appOptions.componentSystems.push(pc.GSplatComponentSystem);
    }
    if (pc.GSplatHandler) {
      appOptions.resourceHandlers.push(pc.GSplatHandler);
    }

    const app = new pc.AppBase(this.canvas);
    app.init(appOptions);
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.start();
    this.app = app;

    // ── Custom render layers ──────────────────────────────────────────────────
    // PlayCanvas sorts transparent objects back-to-front by depth, so a dim
    // plane 0.02 units from the camera would always composite OVER anchors that
    // are 1.5+ units away. Dedicated layers let us force the order:
    //   scene (TRANSPARENT layer) → gsv-dim → gsv-anchors
    // regardless of world-space depth.
    const dimLayer = new pc.Layer({ name: "gsv-dim" });
    const anchorLayer = new pc.Layer({ name: "gsv-anchors" });
    const fovLayer = new pc.Layer({ name: "gsv-fov" });
    const fovStrokeLayer = new pc.Layer({ name: "gsv-fov-stroke" });
    app.scene.layers.push(dimLayer);
    app.scene.layers.push(anchorLayer);
    app.scene.layers.push(fovLayer);
    app.scene.layers.push(fovStrokeLayer);
    const dofDepthLayer = new pc.Layer({ name: "gsv-dof-depth" });
    app.scene.layers.push(dofDepthLayer);
    this.dimLayerId = dimLayer.id;
    this.anchorLayerId = anchorLayer.id;
    this.fovLayerId = fovLayer.id;
    this.fovStrokeLayerId = fovStrokeLayer.id;
    this.dofDepthLayerId = dofDepthLayer.id;
    // ─────────────────────────────────────────────────────────────────────────

    this.app.scene.exposure = 1;

    this.cameraEntity = new pc.Entity("camera");
    this.cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 1),
      fov: 60,
      nearClip: 0.01,
      farClip: 1000,
    });
    app.root.addChild(this.cameraEntity);
    this.cameraEntity.camera.layers = [
      ...this.cameraEntity.camera.layers,
      this.dimLayerId,
      this.anchorLayerId,
      this.fovLayerId,
      this.fovStrokeLayerId,
    ];

    this.rebuildCameraFrame();

    this._contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.onContextLost?.();
    };
    this.canvas.addEventListener("webglcontextlost", this._contextLostHandler);

    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        this._pendingResize = { width, height };
        if (this._resizeRafId == null) {
          this._resizeRafId = requestAnimationFrame(() => {
            this._resizeRafId = null;
            const pending = this._pendingResize;
            if (pending && this.app && this.canvas) {
              this.app.resizeCanvas(pending.width, pending.height);
              this.applyViewportCanvasStyle();
              this.updateFovUniforms();
            }
            this._pendingResize = null;
          });
        }
      }
    });
    this.resizeObserver.observe(container);
  }

  async loadScene(buffer: ArrayBuffer): Promise<SceneInfo> {
    const pc = this.pc;
    const app = this.app;

    const blob = new Blob([buffer], { type: "application/octet-stream" });
    this.blobUrl = URL.createObjectURL(blob);

    return new Promise<SceneInfo>((resolve, reject) => {
      const asset = new pc.Asset("splat", "gsplat", {
        url: this.blobUrl!,
        filename: "scene.ply",
      });

      asset.on("load", () => {
        this.splatAsset = asset;

        app.scene.gsplat.radialSorting = true;

        this.splatEntity = new pc.Entity("gsplat");
        this.splatEntity.addComponent("gsplat", {
          asset: asset,
          unified: true,
          highQualitySH: true,
        });
        this.splatEntity.setEulerAngles(-90, 0, 0);
        app.root.addChild(this.splatEntity);

        const resource = asset.resource;
        let center: Vec3 = { x: 0, y: 0, z: 0 };
        let radius = 10;
        let splatCount = 1;

        if (resource?.splatData) {
          const aabb = new pc.BoundingBox();
          resource.splatData.calcAabb(aabb);
          center = {
            x: aabb.center.x,
            y: aabb.center.z,
            z: -aabb.center.y,
          };
          const he = aabb.halfExtents;
          radius = Math.sqrt(he.x * he.x + he.y * he.y + he.z * he.z);
          splatCount = resource.splatData.numSplats || 1;
        }

        this.splatCenter = center;
        this.splatRadius = radius;

        resolve({ center, radius, splatCount });
      });

      asset.on("error", (err: string) => {
        reject(new Error(`Failed to load PLY: ${err}`));
      });

      app.assets.add(asset);
      app.assets.load(asset);
    });
  }

  dispose(): void {
    if (this._resizeRafId != null) {
      cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = null;
    }
    this._pendingResize = null;

    if (this.canvas && this._contextLostHandler) {
      this.canvas.removeEventListener("webglcontextlost", this._contextLostHandler);
      this._contextLostHandler = null;
    }
    this.onContextLost = null;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    // Clean up all anchors (textures, video elements, GIF frames, DOM nodes)
    this.anchors.forEach((_anchor, id) => this.removeAnchor(id));
    this.anchors.clear();

    // Clean up depth proxies
    this.depthProxies.forEach((proxy) => {
      proxy.entity.destroy();
      proxy.wireframe.destroy();
    });
    this.depthProxies.clear();

    // Remove the hidden GIF container from the DOM
    const gifContainer = document.getElementById("gsv-gif-container");
    if (gifContainer) gifContainer.remove();

    if (this.dofEntity) { this.dofEntity.destroy(); this.dofEntity = null; }
    if (this.dofDepthCamera) { this.dofDepthCamera.destroy(); this.dofDepthCamera = null; }
    if (this.dofDepthEntity) { this.dofDepthEntity.destroy(); this.dofDepthEntity = null; }
    if (this.dofDepthRT) { this.dofDepthRT.destroy(); this.dofDepthRT = null; }
    if (this.dofDepthTexture) { this.dofDepthTexture.destroy(); this.dofDepthTexture = null; }

    this.cameraFrame?.destroy();
    this.cameraFrame = null;

    if (this.app) {
      this.app.destroy();
      this.app = null;
    }

    this.canvas?.remove();
    this.canvas = null;
    this.cameraEntity = null;
    this.splatEntity = null;
    this.splatAsset = null;
    this.gridEntity = null;
    this.gizmoEntity = null;
    this.dimEntity = null;
    this.blurEntity = null;
    this.fovMaskEntity = null;
    this.fovStrokeEntity = null;
    this.dimAmount = 0;
    this.blurAmount = 0;
    this.fovEnabled = false;
    this.fovStrokeVisible = false;
    this.fovFeather = 0;
    this.dimLayerId = -1;
    this.anchorLayerId = -1;
    this.fovLayerId = -1;
    this.fovStrokeLayerId = -1;

    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    if (this.depthMeshBlobUrl) {
      URL.revokeObjectURL(this.depthMeshBlobUrl);
      this.depthMeshBlobUrl = null;
    }
  }

  getCameraPosition(): Vec3 {
    if (!this.cameraEntity) return { x: 0, y: 0, z: 0 };
    const p = this.cameraEntity.getPosition();
    return { x: p.x, y: p.y, z: p.z };
  }

  setCameraPosition(x: number, y: number, z: number): void {
    this.cameraEntity?.setPosition(x, y, z);
  }

  setCameraQuaternion(x: number, y: number, z: number, w: number): void {
    if (!this.cameraEntity || !this.pc) return;
    const q = new this.pc.Quat(x, y, z, w);
    this.cameraEntity.setRotation(q);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  setFov(degrees: number): void {
    if (this.cameraEntity) {
      this.cameraEntity.camera.fov = degrees;
    }
    if (this.dofDepthCamera) {
      this.dofDepthCamera.camera.fov = degrees;
    }
  }

  setExposure(value: number): void {
    if (this.app) {
      this.app.scene.exposure = value;
    }
  }

  setToneMapping(mode: number): void {
    if (this.cameraFrame) {
      this.cameraFrame.rendering.toneMapping = mode;
      this.cameraFrame.update();
    }
  }

  setDofEnabled(enabled: boolean): void {
    this.dofActive = enabled;
    if (!enabled) {
      if (this.dofEntity) this.dofEntity.enabled = false;
      if (this.dofDepthCamera) this.dofDepthCamera.enabled = false;
      if (this.blurEntity && this.blurAmount > 0) this.blurEntity.enabled = true;
      return;
    }
    if (this.blurEntity) this.blurEntity.enabled = false;
    if (!this.dofEntity) this.createDofEntity();
    if (this.dofEntity) this.dofEntity.enabled = true;
    if (this.dofDepthCamera) this.dofDepthCamera.enabled = true;
  }

  setDofFocusDistance(distance: number): void {
    if (this.dofEntity?.enabled) {
      const mi = this.dofEntity.render.meshInstances[0];
      mi.material.setParameter("uFocusDistance", distance);
      mi.material.update();
    }
  }

  setDofFocusRange(fstop: number): void {
    if (this.dofEntity?.enabled) {
      const range = 0.3 + (fstop / 16) * 4.7;
      const mi = this.dofEntity.render.meshInstances[0];
      mi.material.setParameter("uFocusRange", range);
      mi.material.update();
    }
  }

  setDofBlurRadius(radius: number): void {
    if (this.dofEntity?.enabled) {
      const mi = this.dofEntity.render.meshInstances[0];
      mi.material.setParameter("uBlurRadius", radius / 10);
      mi.material.update();
    }
  }

  private createDofEntity(): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app || !this.cameraEntity || this.dimLayerId < 0) return;
    if (!this.depthMeshEntity) return;

    const w = this.canvas?.width ?? 1920;
    const h = this.canvas?.height ?? 1080;
    const DOF_DEPTH_MAX = 30.0;

    // ── 1. Depth render target (half-res for performance) ──
    const dw = Math.max(1, Math.floor(w / 2));
    const dh = Math.max(1, Math.floor(h / 2));
    this.dofDepthTexture = new pc.Texture(app.graphicsDevice, {
      name: "DofDepthTex",
      width: dw,
      height: dh,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    this.dofDepthRT = new pc.RenderTarget({
      name: "DofDepthRT",
      colorBuffer: this.dofDepthTexture,
      depth: true,
      samples: 1,
    });

    // ── 2. Depth-output material for the mesh clones ──
    const depthMat = new pc.ShaderMaterial({
      uniqueName: "gsv-dof-depth-write",
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: [
        "attribute vec3 aPosition;",
        "uniform mat4 matrix_model;",
        "uniform mat4 matrix_viewProjection;",
        "uniform mat4 matrix_view;",
        "void main() {",
        "  gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);",
        "}",
      ].join("\n"),
      fragmentGLSL: [
        "uniform float uNear;",
        "uniform float uFar;",
        "uniform float uMaxDist;",
        "void main() {",
        "  float ndc = gl_FragCoord.z;",
        "  float lin = uNear * uFar / (uFar - ndc * (uFar - uNear));",
        "  float norm = clamp(lin / uMaxDist, 0.0, 1.0);",
        "  gl_FragColor = vec4(norm, norm, norm, 1.0);",
        "}",
      ].join("\n"),
      vertexWGSL: [
        "attribute aPosition: vec3f;",
        "uniform matrix_model: mat4x4f;",
        "uniform matrix_viewProjection: mat4x4f;",
        "uniform matrix_view: mat4x4f;",
        "@vertex fn vertexMain(input: VertexInput) -> VertexOutput {",
        "  var output: VertexOutput;",
        "  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
      fragmentWGSL: [
        "uniform uNear: f32;",
        "uniform uFar: f32;",
        "uniform uMaxDist: f32;",
        "@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {",
        "  var output: FragmentOutput;",
        "  var ndc = input.position.z;",
        "  var lin = uniform.uNear * uniform.uFar / (uniform.uFar - ndc * (uniform.uFar - uniform.uNear));",
        "  var norm = clamp(lin / uniform.uMaxDist, 0.0, 1.0);",
        "  output.color = vec4f(norm, norm, norm, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
    });
    depthMat.setParameter("uNear", 0.01);
    depthMat.setParameter("uFar", 1000.0);
    depthMat.setParameter("uMaxDist", DOF_DEPTH_MAX);
    depthMat.cull = pc.CULLFACE_NONE;
    depthMat.update();

    // ── 3. Clone the depth mesh entity with depth-output material ──
    this.dofDepthEntity = this.depthMeshEntity.clone();
    this.dofDepthEntity.findComponents("render").forEach((render: any) => {
      render.layers = [this.dofDepthLayerId];
      render.meshInstances.forEach((mi: any) => {
        mi.material = depthMat;
      });
    });
    app.root.addChild(this.dofDepthEntity);

    // ── 4. Secondary camera (child of main, renders before it) ──
    this.dofDepthCamera = new pc.Entity("dof-depth-cam");
    this.dofDepthCamera.addComponent("camera", {
      clearColor: new pc.Color(1, 1, 1, 1),
      nearClip: 0.01,
      farClip: 1000,
      priority: -1,
    });
    this.dofDepthCamera.camera.fov = this.cameraEntity.camera.fov;
    this.dofDepthCamera.camera.layers = [this.dofDepthLayerId];
    this.dofDepthCamera.camera.renderTarget = this.dofDepthRT;
    this.cameraEntity.addChild(this.dofDepthCamera);

    // ── 5. DoF fullscreen quad (reads scene color + depth texture) ──
    const quadMesh = new pc.Mesh(app.graphicsDevice);
    quadMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    quadMesh.setIndices([0, 1, 2, 0, 2, 3]);
    quadMesh.update();

    const dofMat = new pc.ShaderMaterial({
      uniqueName: "gsv-dof",
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: [
        "attribute vec3 aPosition;",
        "uniform mat4 matrix_model;",
        "uniform mat4 matrix_viewProjection;",
        "void main() {",
        "  gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);",
        "}",
      ].join("\n"),
      fragmentGLSL: [
        "uniform sampler2D uSceneColorMap;",
        "uniform sampler2D uDofDepthMap;",
        "uniform vec2 uResolution;",
        "uniform float uFocusDistance;",
        "uniform float uFocusRange;",
        "uniform float uBlurRadius;",
        "uniform float uMaxDist;",
        "void main() {",
        "  vec2 uv = gl_FragCoord.xy / uResolution;",
        "  vec2 dtx = 3.0 / uResolution;",
        "  float d0 = texture2D(uDofDepthMap, uv).r;",
        "  float d1 = texture2D(uDofDepthMap, uv + vec2(dtx.x, 0.0)).r;",
        "  float d2 = texture2D(uDofDepthMap, uv - vec2(dtx.x, 0.0)).r;",
        "  float d3 = texture2D(uDofDepthMap, uv + vec2(0.0, dtx.y)).r;",
        "  float d4 = texture2D(uDofDepthMap, uv - vec2(0.0, dtx.y)).r;",
        "  float depthNorm = min(d0, min(min(d1, d2), min(d3, d4)));",
        "  float depth = depthNorm * uMaxDist;",
        "  float diff = abs(depth - uFocusDistance);",
        "  float coc = smoothstep(0.0, uFocusRange, diff);",
        "  float blurAmt = coc * uBlurRadius * 20.0;",
        "  if (blurAmt < 0.5) {",
        "    gl_FragColor = texture2DLod(uSceneColorMap, uv, 0.0);",
        "    return;",
        "  }",
        "  vec2 px = blurAmt / uResolution;",
        "  vec3 c = vec3(0.0);",
        "  for (int i = 0; i < 64; i++) {",
        "    float a = float(i) * 2.3998;",
        "    float r = (i == 0) ? 0.0 : sqrt(float(i) / 63.0);",
        "    c += texture2DLod(uSceneColorMap, uv + r * vec2(cos(a), sin(a)) * px, 0.0).rgb;",
        "  }",
        "  c /= 64.0;",
        "  gl_FragColor = vec4(c, 1.0);",
        "}",
      ].join("\n"),
      vertexWGSL: [
        "attribute aPosition: vec3f;",
        "uniform matrix_model: mat4x4f;",
        "uniform matrix_viewProjection: mat4x4f;",
        "@vertex fn vertexMain(input: VertexInput) -> VertexOutput {",
        "  var output: VertexOutput;",
        "  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
      fragmentWGSL: [
        "var uSceneColorMap: texture_2d<f32>;",
        "var uSceneColorMap_sampler: sampler;",
        "var uDofDepthMap: texture_2d<f32>;",
        "var uDofDepthMap_sampler: sampler;",
        "uniform uResolution: vec2f;",
        "uniform uFocusDistance: f32;",
        "uniform uFocusRange: f32;",
        "uniform uBlurRadius: f32;",
        "uniform uMaxDist: f32;",
        "@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {",
        "  var output: FragmentOutput;",
        "  var uv = input.position.xy / uniform.uResolution;",
        "  var dtx = 3.0 / uniform.uResolution;",
        "  var d0 = textureSampleLevel(uDofDepthMap, uDofDepthMap_sampler, uv, 0.0).r;",
        "  var d1 = textureSampleLevel(uDofDepthMap, uDofDepthMap_sampler, uv + vec2f(dtx.x, 0.0), 0.0).r;",
        "  var d2 = textureSampleLevel(uDofDepthMap, uDofDepthMap_sampler, uv - vec2f(dtx.x, 0.0), 0.0).r;",
        "  var d3 = textureSampleLevel(uDofDepthMap, uDofDepthMap_sampler, uv + vec2f(0.0, dtx.y), 0.0).r;",
        "  var d4 = textureSampleLevel(uDofDepthMap, uDofDepthMap_sampler, uv - vec2f(0.0, dtx.y), 0.0).r;",
        "  var depthNorm = min(d0, min(min(d1, d2), min(d3, d4)));",
        "  var depth = depthNorm * uniform.uMaxDist;",
        "  var diff = abs(depth - uniform.uFocusDistance);",
        "  var coc = smoothstep(0.0, uniform.uFocusRange, diff);",
        "  var blurAmt = coc * uniform.uBlurRadius * 20.0;",
        "  if (blurAmt < 0.5) {",
        "    output.color = textureSampleLevel(uSceneColorMap, uSceneColorMap_sampler, uv, 0.0);",
        "    return output;",
        "  }",
        "  var px = blurAmt / uniform.uResolution;",
        "  var c = vec3f(0.0);",
        "  for (var i: i32 = 0; i < 64; i += 1) {",
        "    var a = f32(i) * 2.3998;",
        "    var r: f32 = 0.0;",
        "    if (i > 0) { r = sqrt(f32(i) / 63.0); }",
        "    c += textureSampleLevel(uSceneColorMap, uSceneColorMap_sampler, uv + r * vec2f(cos(a), sin(a)) * px, 0.0).rgb;",
        "  }",
        "  c /= 64.0;",
        "  output.color = vec4f(c, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
    });
    dofMat.depthState = pc.DepthState.NODEPTH;
    dofMat.blendState = pc.BlendState.NOBLEND;
    dofMat.setParameter("uResolution", [w, h]);
    dofMat.setParameter("uFocusDistance", 5.0);
    dofMat.setParameter("uFocusRange", 3.0);
    dofMat.setParameter("uBlurRadius", 0.4);
    dofMat.setParameter("uMaxDist", DOF_DEPTH_MAX);
    dofMat.setParameter("uDofDepthMap", this.dofDepthTexture);
    dofMat.update();

    const dofMi = new pc.MeshInstance(quadMesh, dofMat);
    this.dofEntity = new pc.Entity("gsv-dof");
    this.dofEntity.addComponent("render", { meshInstances: [dofMi] });
    this.dofEntity.render.layers = [this.dimLayerId];
    this.cameraEntity.addChild(this.dofEntity);
    this.dofEntity.setLocalPosition(0, 0, -0.024);
  }

  private rebuildCameraFrame(): void {
    if (this.cameraFrame) {
      this.cameraFrame.destroy();
      this.cameraFrame = null;
    }

    if (!this.cameraEntity || !this.pc?.CameraFrame || !this.app) return;

    const pc = this.pc;
    const app = this.app;
    const device = app.graphicsDevice;

    const glslChunks = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL);
    const wgslChunks = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL);
    glslChunks.set(
      "composeMainEndPS",
      "result += (fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) * 52.9829189) - 0.5) / 255.0;"
    );
    wgslChunks.set(
      "composeMainEndPS",
      "result += (fract(dot(input.position.xy, vec2f(0.06711056, 0.00583715)) * 52.9829189) - 0.5) / 255.0;"
    );

    this.cameraFrame = new pc.CameraFrame(app, this.cameraEntity.camera);
    this.cameraFrame.rendering.renderFormats = [pc.PIXELFORMAT_111110F, pc.PIXELFORMAT_RGBA16F];
    this.cameraFrame.rendering.toneMapping = pc.TONEMAP_LINEAR;
    this.cameraFrame.rendering.sharpness = 0;
    this.cameraFrame.rendering.samples = 4;
    this.cameraFrame.rendering.sceneColorMap = true;
    this.cameraFrame.taa.enabled = false;
    this.cameraFrame.taa.jitter = 0;
    this.cameraFrame.options.lastGrabLayerId = pc.LAYERID_IMMEDIATE;
    this.cameraFrame.options.lastGrabLayerIsTransparent = true;
    this.cameraFrame.update();
  }

  private updateFovUniforms(): void {
    const device = this.app?.graphicsDevice;
    if (!device) return;
    const w = this.canvas?.width ?? 1920;
    const h = this.canvas?.height ?? 1080;
    const scale = Math.min(w / 1920, h / 1080);
    const scope = (device as any).scope;
    scope.resolve("uFovRect").setValue([
      w * (936 / 1920) / 2,
      h * (774 / 1080) / 2,
      w / 2,
      h / 2,
    ]);
    scope.resolve("uFovRadius").setValue(scale * 224);
    scope.resolve("uFovFeather").setValue(this.fovFeather * scale * 0.3);
    scope.resolve("uFovEnabled").setValue(this.fovEnabled ? 1.0 : 0.0);

    if (this.fovMaskEntity) {
      const mi = this.fovMaskEntity.render.meshInstances[0];
      mi.material.setParameter("uResolution", [w, h]);
      mi.material.setParameter("uDimAmount", this.dimAmount);
      mi.material.setParameter("uBlurRadius", this.blurAmount);
      mi.material.update();
    }

    this.updateDofResolution(w, h);
  }

  private updateDofResolution(w: number, h: number): void {
    if (!this.dofEntity || !this.pc || !this.app) return;

    const mi = this.dofEntity.render?.meshInstances?.[0];
    if (mi) {
      mi.material.setParameter("uResolution", [w, h]);
      mi.material.update();
    }

    const dw = Math.max(1, Math.floor(w / 2));
    const dh = Math.max(1, Math.floor(h / 2));
    if (this.dofDepthTexture && (this.dofDepthTexture.width !== dw || this.dofDepthTexture.height !== dh)) {
      const oldTex = this.dofDepthTexture;
      const oldRT = this.dofDepthRT;

      this.dofDepthTexture = new this.pc.Texture(this.app.graphicsDevice, {
        name: "DofDepthTex",
        width: dw,
        height: dh,
        format: this.pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: this.pc.FILTER_LINEAR,
        magFilter: this.pc.FILTER_LINEAR,
        addressU: this.pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: this.pc.ADDRESS_CLAMP_TO_EDGE,
      });
      this.dofDepthRT = new this.pc.RenderTarget({
        name: "DofDepthRT",
        colorBuffer: this.dofDepthTexture,
        depth: true,
        samples: 1,
      });

      if (this.dofDepthCamera) {
        this.dofDepthCamera.camera.renderTarget = this.dofDepthRT;
      }
      if (mi) {
        mi.material.setParameter("uDofDepthMap", this.dofDepthTexture);
        mi.material.update();
      }

      oldRT?.destroy();
      oldTex?.destroy();
    }
  }

  setFovFrame(enabled: boolean): void {
    this.fovEnabled = enabled;
    this.updateFovUniforms();
    if (enabled && !this.fovMaskEntity) {
      this.createFovMaskEntity();
    }
    if (this.fovMaskEntity) {
      this.fovMaskEntity.enabled = enabled;
    }
    if (enabled && this.fovStrokeVisible && !this.fovStrokeEntity) {
      this.createFovStrokeEntity();
    }
    if (this.fovStrokeEntity) {
      this.fovStrokeEntity.enabled = enabled && this.fovStrokeVisible;
    }
  }

  getFovFrame(): boolean {
    return this.fovEnabled;
  }

  setFovStroke(visible: boolean): void {
    this.fovStrokeVisible = visible;
    if (!this.fovStrokeEntity && visible && this.fovEnabled) {
      this.createFovStrokeEntity();
    }
    if (this.fovStrokeEntity) {
      this.fovStrokeEntity.enabled = this.fovEnabled && visible;
    }
  }

  setFovFeather(amount: number): void {
    this.fovFeather = amount;
    this.updateFovUniforms();
  }

  private createFovMaskEntity(): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app || !this.cameraEntity) return;

    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    mesh.setIndices([0, 1, 2, 0, 2, 3]);
    mesh.update();

    const maskMat = new pc.ShaderMaterial({
      uniqueName: "gsv-fov-mask",
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: [
        "attribute vec3 aPosition;",
        "uniform mat4 matrix_model;",
        "uniform mat4 matrix_viewProjection;",
        "void main() {",
        "  gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);",
        "}",
      ].join("\n"),
      fragmentGLSL: [
        "uniform sampler2D uSceneColorMap;",
        "uniform vec2 uResolution;",
        "uniform vec4 uFovRect;",
        "uniform float uFovRadius;",
        "uniform float uFovFeather;",
        "uniform float uFovEnabled;",
        "uniform float uDimAmount;",
        "uniform float uBlurRadius;",
        "float gsvRoundedRectSDF(vec2 p, vec2 center, vec2 halfSize, float r) {",
        "  vec2 d = abs(p - center) - halfSize + r;",
        "  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;",
        "}",
        "vec3 sampleScene(vec2 uv) {",
        "  if (uBlurRadius <= 0.0) return texture2DLod(uSceneColorMap, uv, 0.0).rgb;",
        "  vec2 px = uBlurRadius * 20.0 / uResolution;",
        "  vec3 c = vec3(0.0);",
        "  for (int i = 0; i < 64; i++) {",
        "    float a = float(i) * 2.3998;",
        "    float r = (i == 0) ? 0.0 : sqrt(float(i) / 63.0);",
        "    c += texture2DLod(uSceneColorMap, uv + r * vec2(cos(a), sin(a)) * px, 0.0).rgb;",
        "  }",
        "  return c / 64.0;",
        "}",
        "void main() {",
        "  if (uFovEnabled < 0.5) discard;",
        "  float dist = gsvRoundedRectSDF(",
        "    gl_FragCoord.xy,",
        "    vec2(uFovRect.z, uFovRect.w),",
        "    vec2(uFovRect.x, uFovRect.y),",
        "    uFovRadius",
        "  );",
        "  if (uFovFeather > 0.0) {",
        "    if (dist <= -uFovFeather) discard;",
        "  } else {",
        "    if (dist <= 0.0) discard;",
        "  }",
        "  vec2 uv = gl_FragCoord.xy / uResolution;",
        "  vec3 scene = sampleScene(uv);",
        "  scene *= (1.0 - uDimAmount);",
        "  float alpha = 1.0;",
        "  if (uFovFeather > 0.0 && dist < 0.0) {",
        "    alpha = smoothstep(-uFovFeather, 0.0, dist);",
        "  }",
        "  gl_FragColor = vec4(scene, alpha);",
        "}",
      ].join("\n"),
      vertexWGSL: [
        "attribute aPosition: vec3f;",
        "uniform matrix_model: mat4x4f;",
        "uniform matrix_viewProjection: mat4x4f;",
        "@vertex fn vertexMain(input: VertexInput) -> VertexOutput {",
        "  var output: VertexOutput;",
        "  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
      fragmentWGSL: [
        "var uSceneColorMap: texture_2d<f32>;",
        "var uSceneColorMap_sampler: sampler;",
        "uniform uResolution: vec2f;",
        "uniform uFovRect: vec4f;",
        "uniform uFovRadius: f32;",
        "uniform uFovFeather: f32;",
        "uniform uFovEnabled: f32;",
        "uniform uDimAmount: f32;",
        "uniform uBlurRadius: f32;",
        "fn gsvRoundedRectSDF(p: vec2f, center: vec2f, halfSize: vec2f, r: f32) -> f32 {",
        "  var d = abs(p - center) - halfSize + r;",
        "  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - r;",
        "}",
        "fn sampleScene(uv: vec2f) -> vec3f {",
        "  if (uniform.uBlurRadius <= 0.0) { return textureSampleLevel(uSceneColorMap, uSceneColorMap_sampler, uv, 0.0).rgb; }",
        "  var px = uniform.uBlurRadius * 20.0 / uniform.uResolution;",
        "  var c = vec3f(0.0);",
        "  for (var i: i32 = 0; i < 64; i += 1) {",
        "    var a = f32(i) * 2.3998;",
        "    var r: f32 = 0.0;",
        "    if (i > 0) { r = sqrt(f32(i) / 63.0); }",
        "    c += textureSampleLevel(uSceneColorMap, uSceneColorMap_sampler, uv + r * vec2f(cos(a), sin(a)) * px, 0.0).rgb;",
        "  }",
        "  return c / 64.0;",
        "}",
        "@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {",
        "  var output: FragmentOutput;",
        "  if (uniform.uFovEnabled < 0.5) { discard; }",
        "  var dist = gsvRoundedRectSDF(",
        "    input.position.xy,",
        "    vec2f(uniform.uFovRect.z, uniform.uFovRect.w),",
        "    vec2f(uniform.uFovRect.x, uniform.uFovRect.y),",
        "    uniform.uFovRadius",
        "  );",
        "  if (uniform.uFovFeather > 0.0) {",
        "    if (dist <= -uniform.uFovFeather) { discard; }",
        "  } else {",
        "    if (dist <= 0.0) { discard; }",
        "  }",
        "  var uv = input.position.xy / uniform.uResolution;",
        "  var scene = sampleScene(uv);",
        "  scene *= (1.0 - uniform.uDimAmount);",
        "  var alpha: f32 = 1.0;",
        "  if (uniform.uFovFeather > 0.0 && dist < 0.0) {",
        "    alpha = smoothstep(-uniform.uFovFeather, 0.0, dist);",
        "  }",
        "  output.color = vec4f(scene, alpha);",
        "  return output;",
        "}",
      ].join("\n"),
    });
    maskMat.depthState = pc.DepthState.NODEPTH;
    maskMat.blendType = pc.BLEND_NORMAL;
    maskMat.cull = pc.CULLFACE_NONE;
    const w = this.canvas?.width ?? 1920;
    const h = this.canvas?.height ?? 1080;
    maskMat.setParameter("uResolution", [w, h]);
    maskMat.setParameter("uDimAmount", this.dimAmount);
    maskMat.setParameter("uBlurRadius", this.blurAmount);
    maskMat.update();

    const mi = new pc.MeshInstance(mesh, maskMat);
    const entity = new pc.Entity("fov-mask");
    entity.addComponent("render", { meshInstances: [mi] });
    entity.render.layers = [this.fovLayerId];
    this.cameraEntity.addChild(entity);
    entity.setLocalPosition(0, 0, -0.028);
    entity.enabled = this.fovEnabled;
    this.fovMaskEntity = entity;
  }

  private createFovStrokeEntity(): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app || !this.cameraEntity) return;

    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    mesh.setIndices([0, 1, 2, 0, 2, 3]);
    mesh.update();

    const strokeMat = new pc.ShaderMaterial({
      uniqueName: "gsv-fov-stroke",
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: [
        "attribute vec3 aPosition;",
        "uniform mat4 matrix_model;",
        "uniform mat4 matrix_viewProjection;",
        "void main() {",
        "  gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);",
        "}",
      ].join("\n"),
      fragmentGLSL: [
        "uniform vec4 uFovRect;",
        "uniform float uFovRadius;",
        "float gsvRoundedRectSDF(vec2 p, vec2 center, vec2 halfSize, float r) {",
        "  vec2 d = abs(p - center) - halfSize + r;",
        "  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;",
        "}",
        "void main() {",
        "  float dist = gsvRoundedRectSDF(",
        "    gl_FragCoord.xy,",
        "    vec2(uFovRect.z, uFovRect.w),",
        "    vec2(uFovRect.x, uFovRect.y),",
        "    uFovRadius",
        "  );",
        "  if (abs(dist) > 2.5) discard;",
        "  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.1);",
        "}",
      ].join("\n"),
      vertexWGSL: [
        "attribute aPosition: vec3f;",
        "uniform matrix_model: mat4x4f;",
        "uniform matrix_viewProjection: mat4x4f;",
        "@vertex fn vertexMain(input: VertexInput) -> VertexOutput {",
        "  var output: VertexOutput;",
        "  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);",
        "  return output;",
        "}",
      ].join("\n"),
      fragmentWGSL: [
        "uniform uFovRect: vec4f;",
        "uniform uFovRadius: f32;",
        "fn gsvRoundedRectSDF(p: vec2f, center: vec2f, halfSize: vec2f, r: f32) -> f32 {",
        "  var d = abs(p - center) - halfSize + r;",
        "  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - r;",
        "}",
        "@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {",
        "  var output: FragmentOutput;",
        "  var dist = gsvRoundedRectSDF(",
        "    input.position.xy,",
        "    vec2f(uniform.uFovRect.z, uniform.uFovRect.w),",
        "    vec2f(uniform.uFovRect.x, uniform.uFovRect.y),",
        "    uniform.uFovRadius",
        "  );",
        "  if (abs(dist) > 2.5) { discard; }",
        "  output.color = vec4f(1.0, 1.0, 1.0, 0.1);",
        "  return output;",
        "}",
      ].join("\n"),
    });
    strokeMat.depthState = pc.DepthState.NODEPTH;
    strokeMat.blendType = pc.BLEND_NORMAL;
    strokeMat.cull = pc.CULLFACE_NONE;
    strokeMat.update();

    const mi = new pc.MeshInstance(mesh, strokeMat);
    const entity = new pc.Entity("fov-stroke");
    entity.addComponent("render", { meshInstances: [mi] });
    entity.render.layers = [this.fovStrokeLayerId];
    this.cameraEntity.addChild(entity);
    entity.setLocalPosition(0, 0, -0.03);
    entity.enabled = this.fovEnabled && this.fovStrokeVisible;
    this.fovStrokeEntity = entity;
  }

  setDim(opacity: number): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app || !this.cameraEntity) return;

    this.dimAmount = Math.min(opacity / 100, 0.6);

    if (!this.dimEntity) {
      const mesh = new pc.Mesh(app.graphicsDevice);
      mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
      mesh.setIndices([0, 1, 2, 0, 2, 3]);
      mesh.update();

      const mat = new pc.StandardMaterial();
      mat.useLighting = false;
      mat.emissive = new pc.Color(0, 0, 0);
      mat.opacity = 0;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.cull = pc.CULLFACE_NONE;
      mat.update();

      const mi = new pc.MeshInstance(mesh, mat);
      const entity = new pc.Entity("dim-overlay");
      entity.addComponent("render", { meshInstances: [mi] });
      entity.render.layers = [this.dimLayerId];
      this.cameraEntity.addChild(entity);
      entity.setLocalPosition(0, 0, -0.02);
      this.dimEntity = entity;
    }

    const mi = this.dimEntity.render.meshInstances[0];
    mi.material.opacity = this.dimAmount;
    mi.material.update();
    this.dimEntity.enabled = this.dimAmount > 0;

    if (this.fovMaskEntity) {
      const maskMi = this.fovMaskEntity.render.meshInstances[0];
      maskMi.material.setParameter("uDimAmount", this.dimAmount);
      maskMi.material.update();
    }
  }

  setBlur(amount: number): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app || !this.cameraEntity) return;

    this.blurAmount = Math.min(amount / 100, 1.0);

    if (!this.blurEntity) {
      const mesh = new pc.Mesh(app.graphicsDevice);
      mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
      mesh.setIndices([0, 1, 2, 0, 2, 3]);
      mesh.update();

      // Both GLSL + WGSL variants required — PlayCanvas's auto-transpiler
      // silently fails on texture sampling inside loops.
      //
      // uSceneColorMap is swapped to the TAA history texture (no mipmaps)
      // by the afterPass.before() hook above, so blur is spatial-only:
      // 32-tap golden-angle spiral at LOD 0 for temporally-stable results.
      const blurMat = new pc.ShaderMaterial({
        uniqueName: "gsv-bg-blur",
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexGLSL: [
          "attribute vec3 aPosition;",
          "uniform mat4 matrix_model;",
          "uniform mat4 matrix_viewProjection;",
          "void main() {",
          "  gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);",
          "}",
        ].join("\n"),
        fragmentGLSL: [
          "uniform sampler2D uSceneColorMap;",
          "uniform vec2 uResolution;",
          "uniform float uBlurRadius;",
          "void main() {",
          "  vec2 uv = gl_FragCoord.xy / uResolution;",
          "  vec2 px = uBlurRadius * 20.0 / uResolution;",
          "  vec3 c = vec3(0.0);",
          "  for (int i = 0; i < 64; i++) {",
          "    float a = float(i) * 2.3998;",
          "    float r = (i == 0) ? 0.0 : sqrt(float(i) / 63.0);",
          "    c += texture2DLod(uSceneColorMap, uv + r * vec2(cos(a), sin(a)) * px, 0.0).rgb;",
          "  }",
          "  c /= 64.0;",
          "  gl_FragColor = vec4(c, 1.0);",
          "}",
        ].join("\n"),
        vertexWGSL: [
          "attribute aPosition: vec3f;",
          "uniform matrix_model: mat4x4f;",
          "uniform matrix_viewProjection: mat4x4f;",
          "@vertex fn vertexMain(input: VertexInput) -> VertexOutput {",
          "  var output: VertexOutput;",
          "  output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);",
          "  return output;",
          "}",
        ].join("\n"),
        fragmentWGSL: [
          "var uSceneColorMap: texture_2d<f32>;",
          "var uSceneColorMap_sampler: sampler;",
          "uniform uResolution: vec2f;",
          "uniform uBlurRadius: f32;",
          "@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {",
          "  var output: FragmentOutput;",
          "  var uv = input.position.xy / uniform.uResolution;",
          "  var px = uniform.uBlurRadius * 20.0 / uniform.uResolution;",
          "  var c = vec3f(0.0);",
          "  for (var i: i32 = 0; i < 64; i += 1) {",
          "    var a = f32(i) * 2.3998;",
          "    var r: f32 = 0.0;",
          "    if (i > 0) { r = sqrt(f32(i) / 63.0); }",
          "    c += textureSampleLevel(uSceneColorMap, uSceneColorMap_sampler, uv + r * vec2f(cos(a), sin(a)) * px, 0.0).rgb;",
          "  }",
          "  c /= 64.0;",
          "  output.color = vec4f(c, 1.0);",
          "  return output;",
          "}",
        ].join("\n"),
      });
      blurMat.depthState = pc.DepthState.NODEPTH;
      blurMat.blendState = pc.BlendState.NOBLEND;
      blurMat.cull = pc.CULLFACE_NONE;
      blurMat.update();

      const mi = new pc.MeshInstance(mesh, blurMat);
      const entity = new pc.Entity("blur-overlay");
      entity.addComponent("render", { meshInstances: [mi] });
      entity.render.layers = [this.dimLayerId];
      this.cameraEntity.addChild(entity);
      entity.setLocalPosition(0, 0, -0.025);
      this.blurEntity = entity;
    }

    const mi = this.blurEntity.render.meshInstances[0];
    const w = this.canvas?.width ?? 1920;
    const h = this.canvas?.height ?? 1080;
    mi.material.setParameter("uResolution", [w, h]);
    mi.material.setParameter("uBlurRadius", this.blurAmount);
    mi.material.update();
    this.blurEntity.enabled = this.blurAmount > 0 && !this.dofActive;

    if (this.fovMaskEntity) {
      const fovMi = this.fovMaskEntity.render.meshInstances[0];
      fovMi.material.setParameter("uBlurRadius", this.blurAmount);
      fovMi.material.update();
    }
  }

  addGrid(center: Vec3, radius: number): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app) return;

    const gridSize = radius * 2.5;
    const divisions = Math.max(10, Math.round(gridSize / 2));
    const half = gridSize / 2;
    const step = gridSize / divisions;
    const y = center.y - radius;

    const positions: number[] = [];

    for (let i = 0; i <= divisions; i++) {
      const t = -half + i * step;
      positions.push(
        center.x + t, y, center.z - half,
        center.x + t, y, center.z + half
      );
      positions.push(
        center.x - half, y, center.z + t,
        center.x + half, y, center.z + t
      );
    }

    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.update(pc.PRIMITIVE_LINES);

    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.emissive = new pc.Color(0.18, 0.18, 0.18);
    material.opacity = 0.5;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.update();

    const meshInstance = new pc.MeshInstance(mesh, material);

    const entity = new pc.Entity("grid");
    entity.addComponent("render", { meshInstances: [meshInstance] });
    app.root.addChild(entity);
    this.gridEntity = entity;
  }

  setGridVisible(visible: boolean): void {
    if (this.gridEntity) {
      this.gridEntity.enabled = visible;
    }
  }

  private buildQuadMesh(
    width: number,
    height: number,
    cornerRadius: number
  ): any {
    const pc = this.pc;
    const app = this.app;
    const mesh = new pc.Mesh(app.graphicsDevice);
    const geo = buildRoundedRectGeometry(width, height, cornerRadius);
    mesh.setPositions(geo.positions);
    mesh.setNormals(geo.normals);
    mesh.setUvs(0, geo.uvs);
    mesh.setIndices(geo.indices);
    mesh.update();
    return mesh;
  }

  private buildNullMesh(size: number): { meshInstances: any[] } {
    const pc = this.pc;
    const app = this.app;
    const RING_SEGS = 32;
    const r = size / 2;
    const axisLen = size * 0.7;
    const meshInstances: any[] = [];

    const axisColors: [number, number, number][] = [
      [1, 0.25, 0.25],
      [0.25, 1, 0.25],
      [0.35, 0.55, 1],
    ];

    const ringPlanes: [
      (a: number) => [number, number, number],
      number
    ][] = [
      [(a) => [0, Math.cos(a) * r, Math.sin(a) * r], 0],
      [(a) => [Math.cos(a) * r, 0, Math.sin(a) * r], 1],
      [(a) => [Math.cos(a) * r, Math.sin(a) * r, 0], 2],
    ];

    for (const [posFn, colorIdx] of ringPlanes) {
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= RING_SEGS; i++) {
        const angle = (i / RING_SEGS) * Math.PI * 2;
        const [x, y, z] = posFn(angle);
        positions.push(x, y, z);
        if (i > 0) indices.push(i - 1, i);
      }
      indices.push(RING_SEGS, 0);

      const mesh = new pc.Mesh(app.graphicsDevice);
      mesh.setPositions(positions);
      mesh.setIndices(indices);
      mesh.update(pc.PRIMITIVE_LINES);

      const mat = new pc.StandardMaterial();
      mat.useLighting = false;
      const c = axisColors[colorIdx];
      mat.emissive = new pc.Color(c[0], c[1], c[2]);
      mat.opacity = 0.7;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthTest = true;
      mat.depthWrite = false;
      mat.cull = pc.CULLFACE_NONE;
      mat.update();

      meshInstances.push(new pc.MeshInstance(mesh, mat));
    }

    const axisEnds: [number, number, number][] = [
      [axisLen, 0, 0],
      [0, axisLen, 0],
      [0, 0, axisLen],
    ];
    for (let i = 0; i < 3; i++) {
      const e = axisEnds[i];
      const positions = [0, 0, 0, e[0], e[1], e[2]];
      const mesh = new pc.Mesh(app.graphicsDevice);
      mesh.setPositions(positions);
      mesh.setIndices([0, 1]);
      mesh.update(pc.PRIMITIVE_LINES);

      const mat = new pc.StandardMaterial();
      mat.useLighting = false;
      const c = axisColors[i];
      mat.emissive = new pc.Color(c[0], c[1], c[2]);
      mat.opacity = 0.9;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthTest = true;
      mat.depthWrite = false;
      mat.cull = pc.CULLFACE_NONE;
      mat.update();

      meshInstances.push(new pc.MeshInstance(mesh, mat));
    }

    return { meshInstances };
  }

  addAnchor(
    position: Vec3,
    rotation: { x: number; y: number; z: number; w: number },
    width: number,
    height: number,
    color: [number, number, number, number],
    cornerRadius = 0,
    existingId?: string
  ): string {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app) return "";

    const id = existingId ?? `anchor-${this.anchorCounter++}`;
    if (existingId) {
      const num = parseInt(existingId.split("-").pop() ?? "0", 10);
      if (!isNaN(num) && num >= this.anchorCounter) {
        this.anchorCounter = num + 1;
      }
    }
    const nullSize = Math.max(width, height) * 0.15;
    const nullGeo = this.buildNullMesh(nullSize);

    const material = nullGeo.meshInstances[0]?.material ?? new pc.StandardMaterial();

    const entity = new pc.Entity(id);
    entity.addComponent("render", { meshInstances: nullGeo.meshInstances });
    entity.render.layers = [this.anchorLayerId];
    app.root.addChild(entity);
    entity.setLocalPosition(position.x, position.y, position.z);
    entity.setLocalRotation(
      new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w)
    );

    this.anchors.set(id, {
      entity, material, color,
      billboardMode: "none",
      baseEulerX: 0,
      baseEulerZ: 0,
      baseWidth: width,
      baseHeight: height,
      cornerRadius,
      baseScale: 1,
      leashed: false,
      leashDistance: 2,
      leashOffset: { x: 0, y: 0, z: 0 },
      leashRotationOffset: { x: 0, y: 0, z: 0 },
      texture: null,
      hasMedia: false,
    });
    return id;
  }

  removeAnchor(id: string): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      if (anchor.videoEl) { anchor.videoEl.pause(); anchor.videoEl.src = ""; }
      if (anchor.gifEl) {
        if (anchor.gifEl.parentNode) anchor.gifEl.parentNode.removeChild(anchor.gifEl);
        anchor.gifEl.src = "";
      }
      anchor.gifCanvas = undefined;
      anchor.gifFrames?.forEach((f) => f.close());
      anchor.gifFrames = undefined;
      if (anchor.texture) anchor.texture.destroy();
      anchor.entity.destroy();
      this.anchors.delete(id);
    }
  }

  setAnchorPosition(id: string, position: Vec3): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      anchor.entity.setLocalPosition(position.x, position.y, position.z);
    }
  }

  setAnchorRotation(id: string, euler: Vec3): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      anchor.entity.setLocalEulerAngles(euler.x, euler.y, euler.z);
    }
  }

  rebuildAnchor(
    id: string,
    width: number,
    height: number,
    cornerRadius: number,
    clearMedia = false
  ): void {
    const pc = this.pc;
    const anchor = this.anchors.get(id);
    if (!anchor || !pc) return;

    if (clearMedia) {
      if (anchor.videoEl) { anchor.videoEl.pause(); anchor.videoEl.src = ""; }
      anchor.texture = null;
      anchor.hasMedia = false;
      anchor.videoEl = undefined;
      anchor.videoCanvas = undefined;
      if (anchor.gifEl?.parentNode) anchor.gifEl.parentNode.removeChild(anchor.gifEl);
      anchor.gifEl = undefined;
    }

    if (anchor.hasMedia && anchor.texture) {
      const mesh = this.buildQuadMesh(width, height, cornerRadius);
      const material = new pc.StandardMaterial();
      material.useLighting = false;
      material.emissive = new pc.Color(1, 1, 1);
      material.emissiveMap = anchor.texture;
      material.opacity = anchor.color[3] ?? 1;
      material.blendType = pc.BLEND_SCREEN;
      material.depthTest = true;
      material.depthWrite = false;
      material.cull = pc.CULLFACE_NONE;
      material.update();

      const meshInstance = new pc.MeshInstance(mesh, material);
      anchor.entity.render.meshInstances = [meshInstance];
      anchor.material = material;
    } else {
      const nullSize = Math.max(width, height) * 0.15;
      const nullGeo = this.buildNullMesh(nullSize);
      anchor.entity.render.meshInstances = nullGeo.meshInstances;
      anchor.material = nullGeo.meshInstances[0]?.material;
    }

    anchor.baseWidth = width;
    anchor.baseHeight = height;
    anchor.cornerRadius = cornerRadius;
  }

  setAnchorOpacity(id: string, opacity: number): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      anchor.color[3] = opacity;
      anchor.material.opacity = opacity;
      anchor.material.update();
    }
  }

  setAnchorScale(id: string, scale: number): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      anchor.baseScale = scale;
      anchor.entity.setLocalScale(scale, scale, scale);
    }
  }

  setAnchorLeash(id: string, leashed: boolean, distance: number, offset: { x: number; y: number; z: number }): void {
    const anchor = this.anchors.get(id);
    if (!anchor) return;
    anchor.leashed = leashed;
    anchor.leashDistance = distance;
    anchor.leashOffset = { ...offset };
    if (anchor.material) {
      anchor.material.depthTest = !leashed;
      anchor.material.update();
    }
  }

  setAnchorLeashRotation(id: string, rotation: { x: number; y: number; z: number }): void {
    const anchor = this.anchors.get(id);
    if (anchor) anchor.leashRotationOffset = { ...rotation };
  }

  setAnchorBillboard(id: string, mode: "none" | "full" | "y-axis"): void {
    const anchor = this.anchors.get(id);
    if (!anchor) return;

    if (mode !== "none" && anchor.billboardMode === "none") {
      const angles = anchor.entity.getLocalEulerAngles();
      anchor.baseEulerX = angles.x;
      anchor.baseEulerZ = angles.z;
    }
    anchor.billboardMode = mode;
  }

  setAnchorMedia(id: string, source: ImageBitmap | HTMLVideoElement | HTMLImageElement): void {
    const pc = this.pc;
    const app = this.app;
    const anchor = this.anchors.get(id);
    if (!anchor || !pc || !app) return;

    if (anchor.texture) anchor.texture.destroy();
    anchor.videoEl = undefined;
    anchor.videoCanvas = undefined;
    if (anchor.gifEl) {
      if (anchor.gifEl.parentNode) anchor.gifEl.parentNode.removeChild(anchor.gifEl);
      anchor.gifEl.src = "";
    }
    anchor.gifEl = undefined;
    anchor.gifCanvas = undefined;
    anchor.gifFrames?.forEach((f) => f.close());
    anchor.gifFrames = undefined;

    const isVideo = source instanceof HTMLVideoElement;
    const isGif = source instanceof HTMLImageElement;
    const srcW = isVideo ? (source.videoWidth || 256) : isGif ? (source.naturalWidth || 256) : source.width || 256;
    const srcH = isVideo ? (source.videoHeight || 256) : isGif ? (source.naturalHeight || 256) : source.height || 256;

    const texture = new pc.Texture(app.graphicsDevice, {
      width: srcW,
      height: srcH,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });

    if (isVideo) {
      // WebGPU's copyExternalImageToTexture can reject HTMLVideoElement sources
      // that lack a GPU back-resource (detached elements, first-frame races).
      // Route every video upload through a canvas intermediary instead.
      const vc = document.createElement("canvas");
      vc.width = srcW;
      vc.height = srcH;
      const ctx = vc.getContext("2d");
      if (ctx && source.readyState >= 2) {
        ctx.drawImage(source, 0, 0, srcW, srcH);
      }
      texture.setSource(vc);
      anchor.videoCanvas = vc;
      anchor.videoEl = source;
    } else if (!isGif) {
      texture.setSource(source);
    }

    if (isGif) {
      // Attach to a hidden off-screen container so the browser's GIF decoder
      // keeps advancing animation frames (some browsers freeze off-DOM images).
      let gifContainer = document.getElementById("gsv-gif-container");
      if (!gifContainer) {
        gifContainer = document.createElement("div");
        gifContainer.id = "gsv-gif-container";
      // Must be in the layout tree and not opacity-0 / z-index:-1, otherwise
      // Chrome 120+ throttles or stops GIF frame advancement for elements it
      // considers "fully invisible". clip-path hides it visually while keeping
      // it in the active render tree so the browser keeps animating frames.
        gifContainer.style.cssText =
          "position:fixed;left:0;top:0;pointer-events:none;clip-path:polygon(0 0,0 0,0 0);";
        document.body.appendChild(gifContainer);
      }
      gifContainer.appendChild(source);
      anchor.gifEl = source;

      const canvas = document.createElement("canvas");
      canvas.width = srcW;
      canvas.height = srcH;
      anchor.gifCanvas = canvas;

      // Seed the texture with frame 0 via the canvas.
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(source, 0, 0, srcW, srcH);
        texture.setSource(canvas);
      }
    }

    anchor.texture = texture;
    anchor.hasMedia = true;

    const mesh = this.buildQuadMesh(anchor.baseWidth, anchor.baseHeight, anchor.cornerRadius);
    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.emissive = new pc.Color(1, 1, 1);
    material.emissiveMap = texture;
    material.opacity = anchor.color[3] ?? 1;
    material.blendType = pc.BLEND_SCREEN;
    material.depthTest = true;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.update();

    const meshInstance = new pc.MeshInstance(mesh, material);
    anchor.entity.render.meshInstances = [meshInstance];
    anchor.material = material;
  }

  setAnchorGifFrames(id: string, frames: ImageBitmap[], durations: number[]): void {
    const pc = this.pc;
    const app = this.app;
    const anchor = this.anchors.get(id);
    if (!anchor || !pc || !app || frames.length === 0) return;

    // Tear down any existing media on this anchor.
    if (anchor.texture) anchor.texture.destroy();
    if (anchor.videoEl) { anchor.videoEl.pause(); anchor.videoEl.src = ""; anchor.videoEl = undefined; }
    if (anchor.gifEl) {
      if (anchor.gifEl.parentNode) anchor.gifEl.parentNode.removeChild(anchor.gifEl);
      anchor.gifEl.src = "";
      anchor.gifEl = undefined;
    }
    anchor.gifCanvas = undefined;
    anchor.gifFrames?.forEach((f) => f.close());

    const first = frames[0];
    const srcW = first.width;
    const srcH = first.height;

    const texture = new pc.Texture(app.graphicsDevice, {
      width: srcW,
      height: srcH,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.setSource(first);

    anchor.texture = texture;
    anchor.hasMedia = true;
    anchor.gifFrames = frames;
    anchor.gifDurations = durations;
    anchor.gifStartTime = performance.now();
    anchor.gifCurrentFrame = 0;

    const mesh = this.buildQuadMesh(anchor.baseWidth, anchor.baseHeight, anchor.cornerRadius);
    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.emissive = new pc.Color(1, 1, 1);
    material.emissiveMap = texture;
    material.opacity = anchor.color[3] ?? 1;
    material.blendType = pc.BLEND_SCREEN;
    material.depthTest = true;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.update();

    const meshInstance = new pc.MeshInstance(mesh, material);
    anchor.entity.render.meshInstances = [meshInstance];
    anchor.material = material;
  }

  updateVideoTextures(): void {
    this.anchors.forEach((anchor) => {
      if (anchor.videoEl && anchor.texture && anchor.videoCanvas) {
        if (!anchor.videoEl.paused && !anchor.videoEl.ended && anchor.videoEl.readyState >= 2) {
          const ctx = anchor.videoCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(anchor.videoEl, 0, 0, anchor.videoCanvas.width, anchor.videoCanvas.height);
            anchor.texture.setSource(anchor.videoCanvas);
          }
        }
      }
      // ImageDecoder path: advance frames based on wall-clock time; only upload
      // when the frame index actually changes (avoids needless GPU uploads).
      if (anchor.gifFrames && anchor.gifFrames.length > 0 && anchor.texture) {
        const totalMs = anchor.gifDurations!.reduce((s, d) => s + d / 1000, 0);
        if (totalMs <= 0) return;
        const elapsed = (performance.now() - anchor.gifStartTime!) % totalMs;
        let cumulative = 0;
        let frameIdx = anchor.gifFrames.length - 1;
        for (let i = 0; i < anchor.gifDurations!.length; i++) {
          cumulative += anchor.gifDurations![i] / 1000;
          if (elapsed < cumulative) { frameIdx = i; break; }
        }
        if (frameIdx !== anchor.gifCurrentFrame) {
          anchor.gifCurrentFrame = frameIdx;
          anchor.texture.setSource(anchor.gifFrames[frameIdx]);
        }
      } else if (anchor.gifEl && anchor.gifCanvas && anchor.texture && anchor.gifEl.complete) {
        // HTMLImageElement fallback (Firefox / Safari): draw the browser-animated
        // img to canvas and upload. Only runs when ImageDecoder was unavailable.
        const ctx = anchor.gifCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, anchor.gifCanvas.width, anchor.gifCanvas.height);
          ctx.drawImage(anchor.gifEl, 0, 0, anchor.gifCanvas.width, anchor.gifCanvas.height);
          anchor.texture.setSource(anchor.gifCanvas);
        }
      }
    });
  }

  seekAnchorGifsToTime(compositionTimeSec: number): void {
    this.anchors.forEach((anchor) => {
      if (!anchor.gifFrames || anchor.gifFrames.length === 0 || !anchor.texture) return;
      const durations = anchor.gifDurations!;
      // durations are in microseconds; convert to ms for comparison
      const totalMs = durations.reduce((s, d) => s + d / 1000, 0);
      if (totalMs <= 0) return;
      const elapsedMs = (compositionTimeSec * 1000) % totalMs;
      let cumulative = 0;
      let frameIdx = anchor.gifFrames.length - 1;
      for (let i = 0; i < durations.length; i++) {
        cumulative += durations[i] / 1000;
        if (elapsedMs < cumulative) { frameIdx = i; break; }
      }
      anchor.gifCurrentFrame = frameIdx;
      anchor.texture.setSource(anchor.gifFrames[frameIdx]);
    });
  }

  pauseAnchorVideos(): void {
    this.anchors.forEach((anchor) => {
      if (anchor.videoEl) anchor.videoEl.pause();
    });
  }

  resumeAnchorVideos(): void {
    this.anchors.forEach((anchor) => {
      if (anchor.videoEl) anchor.videoEl.play().catch(() => {});
    });
  }

  async seekAnchorVideosToTime(
    anchorVideoTimes: Array<{ id: string; time: number }>
  ): Promise<void> {
    const SEEK_TIMEOUT_MS = 200;
    const seeks: Promise<void>[] = [];

    for (const { id, time } of anchorVideoTimes) {
      const anchor = this.anchors.get(id);
      if (!anchor?.videoEl || !anchor.texture || !anchor.videoCanvas) continue;

      const video = anchor.videoEl;
      const vc = anchor.videoCanvas;
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) continue;

      const videoTime = duration > 0 ? time % duration : 0;

      const uploadFrame = () => {
        if (video.readyState >= 2) {
          const ctx = vc.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, vc.width, vc.height);
            anchor.texture.setSource(vc);
          }
        }
      };

      if (Math.abs(video.currentTime - videoTime) < 0.001) {
        uploadFrame();
        continue;
      }

      seeks.push(
        new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            video.removeEventListener("seeked", done);
            uploadFrame();
            resolve();
          };
          video.addEventListener("seeked", done);
          video.currentTime = videoTime;
          setTimeout(done, SEEK_TIMEOUT_MS);
        })
      );
    }

    if (seeks.length > 0) await Promise.all(seeks);
  }

  setAnchorVisible(id: string, visible: boolean): void {
    const anchor = this.anchors.get(id);
    if (anchor) {
      anchor.entity.enabled = visible;
    }
  }

  setAnchorEntranceState(id: string, progress: number, preset: string): void {
    const anchor = this.anchors.get(id);
    if (!anchor) return;

    const p = Math.max(0, Math.min(1, progress));

    if (preset === "fade" || preset === "fade-scale") {
      anchor.material.opacity = p * (anchor.color[3] ?? 1);
      anchor.material.update();
    }
    if (preset === "scale" || preset === "fade-scale") {
      const s = p * anchor.baseScale;
      anchor.entity.setLocalScale(s, s, 1);
    }
    if (preset === "none") {
      anchor.entity.enabled = p >= 0.5;
    }
  }

  getAnchorIds(): string[] {
    const ids: string[] = [];
    this.anchors.forEach((_v, k) => ids.push(k));
    return ids;
  }

  updateBillboards(): void {
    if (!this.cameraEntity) return;
    const camPos = this.cameraEntity.getPosition();

    this.anchors.forEach((anchor) => {
      if (anchor.leashed) {
        const pc = this.pc;
        const camMat = this.cameraEntity.getWorldTransform();
        const d = camMat.data;
        const right = { x: d[0], y: d[1], z: d[2] };
        const up = { x: d[4], y: d[5], z: d[6] };
        const fwd = { x: -d[8], y: -d[9], z: -d[10] };
        const off = anchor.leashOffset;
        const dist = anchor.leashDistance;
        anchor.entity.setLocalPosition(
          camPos.x + fwd.x * dist + right.x * off.x + up.x * off.y + fwd.x * off.z,
          camPos.y + fwd.y * dist + right.y * off.x + up.y * off.y + fwd.y * off.z,
          camPos.z + fwd.z * dist + right.z * off.x + up.z * off.y + fwd.z * off.z,
        );
        const camRot = this.cameraEntity.getRotation();
        const r = anchor.leashRotationOffset;
        const offsetQuat = new pc.Quat().setFromEulerAngles(r.x, r.y, r.z);
        const finalRot = new pc.Quat().mul2(camRot, offsetQuat);
        anchor.entity.setRotation(finalRot);
        return;
      }

      const pos = anchor.entity.getPosition();

      if (anchor.billboardMode === "none") return;

      anchor.entity.lookAt(camPos.x, camPos.y, camPos.z);
      const angles = anchor.entity.getLocalEulerAngles();
      anchor.entity.setLocalEulerAngles(angles.x, angles.y + 180, angles.z);
    });
  }

  addDepthProxy(
    position: Vec3,
    rotation: { x: number; y: number; z: number; w: number },
    width: number,
    height: number
  ): string {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app) return "";

    const id = `depth-proxy-${this.depthProxyCounter++}`;
    const mesh = this.buildQuadMesh(width, height, 0);

    const depthMat = new pc.StandardMaterial();
    depthMat.useLighting = false;
    depthMat.emissive = new pc.Color(0, 0, 0);
    depthMat.opacity = 1;
    depthMat.blendType = pc.BLEND_NONE;
    depthMat.depthTest = true;
    depthMat.depthWrite = true;
    depthMat.cull = pc.CULLFACE_NONE;
    depthMat.update();

    const depthInstance = new pc.MeshInstance(mesh, depthMat);
    const entity = new pc.Entity(id);
    entity.addComponent("render", { meshInstances: [depthInstance] });
    app.root.addChild(entity);
    entity.setPosition(position.x, position.y, position.z);
    entity.setRotation(
      new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w)
    );

    const hw = width / 2;
    const hh = height / 2;
    const wireMesh = new pc.Mesh(app.graphicsDevice);
    wireMesh.setPositions([
      -hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0, -hw, -hh, 0,
    ]);
    wireMesh.update(pc.PRIMITIVE_LINESTRIP);

    const wireMat = new pc.StandardMaterial();
    wireMat.useLighting = false;
    wireMat.emissive = new pc.Color(1, 0.4, 0);
    wireMat.opacity = 0.8;
    wireMat.blendType = pc.BLEND_NORMAL;
    wireMat.depthWrite = false;
    wireMat.depthTest = false;
    wireMat.cull = pc.CULLFACE_NONE;
    wireMat.update();

    const wireInstance = new pc.MeshInstance(wireMesh, wireMat);
    const wireEntity = new pc.Entity(`${id}-wire`);
    wireEntity.addComponent("render", { meshInstances: [wireInstance] });
    app.root.addChild(wireEntity);
    wireEntity.setPosition(position.x, position.y, position.z);
    wireEntity.setRotation(
      new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w)
    );
    wireEntity.enabled = this.showProxyWireframes;

    this.depthProxies.set(id, { entity, wireframe: wireEntity, material: depthMat });
    return id;
  }

  removeDepthProxy(id: string): void {
    const proxy = this.depthProxies.get(id);
    if (proxy) {
      proxy.entity.destroy();
      proxy.wireframe.destroy();
      this.depthProxies.delete(id);
    }
  }

  setDepthProxyPosition(id: string, position: Vec3): void {
    const proxy = this.depthProxies.get(id);
    if (proxy) {
      proxy.entity.setPosition(position.x, position.y, position.z);
      proxy.wireframe.setPosition(position.x, position.y, position.z);
    }
  }

  setDepthProxyRotation(id: string, euler: Vec3): void {
    const proxy = this.depthProxies.get(id);
    if (proxy) {
      proxy.entity.setEulerAngles(euler.x, euler.y, euler.z);
      proxy.wireframe.setEulerAngles(euler.x, euler.y, euler.z);
    }
  }

  rebuildDepthProxy(id: string, width: number, height: number): void {
    const pc = this.pc;
    const app = this.app;
    const proxy = this.depthProxies.get(id);
    if (!proxy || !pc || !app) return;

    const pos = proxy.entity.getPosition().clone();
    const rot = proxy.entity.getRotation().clone();
    const wireVisible = proxy.wireframe.enabled;
    proxy.entity.destroy();
    proxy.wireframe.destroy();

    const mesh = this.buildQuadMesh(width, height, 0);
    const depthMat = new pc.StandardMaterial();
    depthMat.useLighting = false;
    depthMat.emissive = new pc.Color(0, 0, 0);
    depthMat.opacity = 1;
    depthMat.blendType = pc.BLEND_NONE;
    depthMat.depthTest = true;
    depthMat.depthWrite = true;
    depthMat.cull = pc.CULLFACE_NONE;
    depthMat.update();

    const depthInstance = new pc.MeshInstance(mesh, depthMat);
    const entity = new pc.Entity(id);
    entity.addComponent("render", { meshInstances: [depthInstance] });
    app.root.addChild(entity);
    entity.setPosition(pos);
    entity.setRotation(rot);

    const hw = width / 2;
    const hh = height / 2;
    const wireMesh = new pc.Mesh(app.graphicsDevice);
    wireMesh.setPositions([
      -hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0, -hw, -hh, 0,
    ]);
    wireMesh.update(pc.PRIMITIVE_LINESTRIP);

    const wireMat = new pc.StandardMaterial();
    wireMat.useLighting = false;
    wireMat.emissive = new pc.Color(1, 0.4, 0);
    wireMat.opacity = 0.8;
    wireMat.blendType = pc.BLEND_NORMAL;
    wireMat.depthWrite = false;
    wireMat.depthTest = false;
    wireMat.cull = pc.CULLFACE_NONE;
    wireMat.update();

    const wireInstance = new pc.MeshInstance(wireMesh, wireMat);
    const wireEntity = new pc.Entity(`${id}-wire`);
    wireEntity.addComponent("render", { meshInstances: [wireInstance] });
    app.root.addChild(wireEntity);
    wireEntity.setPosition(pos);
    wireEntity.setRotation(rot);
    wireEntity.enabled = wireVisible;

    proxy.entity = entity;
    proxy.wireframe = wireEntity;
    proxy.material = depthMat;
  }

  setProxyWireframeVisible(visible: boolean): void {
    this.showProxyWireframes = visible;
    this.depthProxies.forEach((proxy) => {
      proxy.wireframe.enabled = visible;
    });
  }

  // --- Gizmo handles ---

  showGizmo(position: Vec3): void {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app) return;

    this.hideGizmo();

    const HANDLE_LEN = 0.075;
    const gizmo = new pc.Entity("gizmo");

    const axes: [string, number[], number[]][] = [
      ["x", [1, 0.15, 0.15], [HANDLE_LEN, 0, 0]],
      ["y", [0.15, 1, 0.15], [0, HANDLE_LEN, 0]],
      ["z", [0.15, 0.4, 1], [0, 0, HANDLE_LEN]],
    ];

    for (const [name, color, end] of axes) {
      const mat = new pc.StandardMaterial();
      mat.useLighting = false;
      mat.emissive = new pc.Color(
        color[0] as number,
        color[1] as number,
        color[2] as number
      );
      mat.opacity = 1;
      mat.blendType = pc.BLEND_NONE;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.cull = pc.CULLFACE_NONE;
      mat.update();

      const t = 0.0012;
      const ex = end[0] as number, ey = end[1] as number, ez = end[2] as number;
      const shaftPositions: number[] = [];
      const shaftIndices: number[] = [];
      const offsets: [number, number, number][] =
        name === "x"
          ? [[0, t, 0], [0, -t, 0], [0, 0, t], [0, 0, -t]]
          : name === "y"
          ? [[t, 0, 0], [-t, 0, 0], [0, 0, t], [0, 0, -t]]
          : [[t, 0, 0], [-t, 0, 0], [0, t, 0], [0, -t, 0]];
      for (let q = 0; q < 2; q++) {
        const a = offsets[q * 2], b = offsets[q * 2 + 1];
        const base = shaftPositions.length / 3;
        shaftPositions.push(
          a[0], a[1], a[2],
          b[0], b[1], b[2],
          ex + b[0], ey + b[1], ez + b[2],
          ex + a[0], ey + a[1], ez + a[2]
        );
        shaftIndices.push(
          base, base + 1, base + 2, base, base + 2, base + 3,
          base + 2, base + 1, base, base + 3, base + 2, base
        );
      }
      const shaftMesh = new pc.Mesh(app.graphicsDevice);
      shaftMesh.setPositions(shaftPositions);
      shaftMesh.setIndices(shaftIndices);
      shaftMesh.update();

      const shaftMi = new pc.MeshInstance(shaftMesh, mat);
      const child = new pc.Entity(`gizmo-${name}`);
      child.addComponent("render", {
        meshInstances: [shaftMi],
        castShadows: false,
      });
      if (this.anchorLayerId >= 0) child.render.layers = [this.anchorLayerId];
      gizmo.addChild(child);

      const s = 0.005;
      const cx = ex, cy = ey, cz = ez;
      const tipPositions = [
        cx-s, cy-s, cz-s,  cx+s, cy-s, cz-s,  cx+s, cy+s, cz-s,  cx-s, cy+s, cz-s,
        cx-s, cy-s, cz+s,  cx+s, cy-s, cz+s,  cx+s, cy+s, cz+s,  cx-s, cy+s, cz+s,
      ];
      const tipIndices = [
        0,1,2, 0,2,3,  4,6,5, 4,7,6,
        0,4,5, 0,5,1,  2,6,7, 2,7,3,
        0,3,7, 0,7,4,  1,5,6, 1,6,2,
      ];
      const tipMesh = new pc.Mesh(app.graphicsDevice);
      tipMesh.setPositions(tipPositions);
      tipMesh.setIndices(tipIndices);
      tipMesh.update();

      const tipMi = new pc.MeshInstance(tipMesh, mat);
      const tipChild = new pc.Entity(`gizmo-tip-${name}`);
      tipChild.addComponent("render", {
        meshInstances: [tipMi],
        castShadows: false,
      });
      if (this.anchorLayerId >= 0) tipChild.render.layers = [this.anchorLayerId];
      gizmo.addChild(tipChild);
    }

    app.root.addChild(gizmo);
    gizmo.setPosition(position.x, position.y, position.z);
    gizmo.setEulerAngles(0, this.sceneYawDeg, 0);
    this.gizmoEntity = gizmo;
  }

  hideGizmo(): void {
    if (this.gizmoEntity) {
      this.gizmoEntity.destroy();
      this.gizmoEntity = null;
    }
  }

  prepareForCapture(): void {
    this.captureState = {
      gizmoWasVisible: !!this.gizmoEntity?.enabled,
      gridWasVisible: !!this.gridEntity?.enabled,
      wireframesWereVisible: this.showProxyWireframes,
      depthMeshWasDebug: this.isDepthMeshDebugActive(),
    };
    if (this.gizmoEntity) this.gizmoEntity.enabled = false;
    if (this.gridEntity) this.gridEntity.enabled = false;
    if (this.showProxyWireframes) this.setProxyWireframeVisible(false);
    if (this.captureState.depthMeshWasDebug) this.setDepthMeshDebugView(false);
  }

  restoreAfterCapture(): void {
    const s = this.captureState;
    if (!s) return;
    this.captureState = null;
    if (this.gizmoEntity) this.gizmoEntity.enabled = s.gizmoWasVisible;
    if (this.gridEntity) this.gridEntity.enabled = s.gridWasVisible;
    if (s.wireframesWereVisible) this.setProxyWireframeVisible(true);
    if (s.depthMeshWasDebug) this.setDepthMeshDebugView(true);
  }

  private isDepthMeshDebugActive(): boolean {
    if (!this.depthMeshEntity || !this.depthMeshDebugMaterial) return false;
    const renders = this.depthMeshEntity.findComponents("render");
    if (renders.length === 0) return false;
    const mi = renders[0].meshInstances[0];
    return mi?.material === this.depthMeshDebugMaterial;
  }

  getAnchorAxes(id: string): { center: Vec3; right: Vec3; up: Vec3; forward: Vec3 } | null {
    const anchor = this.anchors.get(id);
    if (!anchor) return null;
    const yawRad = this.sceneYawDeg * (Math.PI / 180);
    const cos = Math.cos(yawRad);
    const sin = Math.sin(yawRad);
    const lp = anchor.entity.getLocalPosition();
    return {
      center: { x: lp.x, y: lp.y, z: lp.z },
      right:   { x: cos, y: 0, z: sin },
      up:      { x: 0, y: 1, z: 0 },
      forward: { x: -sin, y: 0, z: cos },
    };
  }

  worldToScreen(worldPos: Vec3): { x: number; y: number } | null {
    if (!this.cameraEntity || !this.canvas || !this.app) return null;
    const camera = this.cameraEntity.camera;
    const pc = this.pc;
    const screenPos = new pc.Vec3();
    camera.worldToScreen(
      new pc.Vec3(worldPos.x, worldPos.y, worldPos.z),
      screenPos
    );
    if (screenPos.z < 0) return null;
    return { x: screenPos.x, y: screenPos.y };
  }

  async loadDepthMesh(buffer: ArrayBuffer, filename: string): Promise<void> {
    const pc = this.pc;
    const app = this.app;
    if (!pc || !app) return;

    if (this.depthMeshEntity) {
      this.depthMeshEntity.destroy();
      this.depthMeshEntity = null;
    }
    if (this.depthMeshBlobUrl) {
      URL.revokeObjectURL(this.depthMeshBlobUrl);
    }

    const blob = new Blob([buffer], { type: "model/gltf-binary" });
    this.depthMeshBlobUrl = URL.createObjectURL(blob);

    return new Promise<void>((resolve, reject) => {
      const asset = new pc.Asset("depth-mesh", "container", {
        url: this.depthMeshBlobUrl!,
        filename,
      });

      asset.on("load", () => {
        const entity = asset.resource.instantiateRenderEntity();

        const depthMat = new pc.StandardMaterial();
        depthMat.useLighting = false;
        depthMat.emissive = new pc.Color(0, 0, 0);
        depthMat.opacity = 1;
        depthMat.blendType = pc.BLEND_NONE;
        depthMat.depthTest = true;
        depthMat.depthWrite = true;
        depthMat.depthBias = 5;
        depthMat.slopeDepthBias = 5;
        depthMat.cull = pc.CULLFACE_NONE;
        depthMat.redWrite = false;
        depthMat.greenWrite = false;
        depthMat.blueWrite = false;
        depthMat.alphaWrite = false;
        depthMat.update();
        this.depthMeshMaterial = depthMat;

        const debugMat = new pc.StandardMaterial();
        debugMat.useLighting = false;
        debugMat.emissive = new pc.Color(0, 0, 0);
        debugMat.opacity = 0.6;
        debugMat.blendType = pc.BLEND_NORMAL;
        debugMat.depthTest = false;
        debugMat.depthWrite = false;
        debugMat.cull = pc.CULLFACE_NONE;
        debugMat.update();
        this.depthMeshDebugMaterial = debugMat;

        entity.findComponents("render").forEach((render: any) => {
          render.layers = [this.anchorLayerId];
          render.meshInstances.forEach((mi: any) => {
            mi.material = depthMat;
          });
        });

        entity.setLocalScale(1, 1, 1);

        app.root.addChild(entity);
        this.depthMeshEntity = entity;

        resolve();
      });

      asset.on("error", (err: string) => {
        reject(new Error(`Failed to load depth mesh: ${err}`));
      });

      app.assets.add(asset);
      app.assets.load(asset);
    });
  }

  setDepthMeshVisible(visible: boolean): void {
    if (this.depthMeshEntity) {
      this.depthMeshEntity.enabled = visible;
    }
  }

  setDepthMeshTransform(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale: number
  ): void {
    if (this.depthMeshEntity) {
      this.depthMeshEntity.setPosition(position.x, position.y, position.z);
      this.depthMeshEntity.setEulerAngles(rotation.x, rotation.y, rotation.z);
      this.depthMeshEntity.setLocalScale(scale, scale, scale);
    }
    if (this.dofDepthEntity) {
      this.dofDepthEntity.setPosition(position.x, position.y, position.z);
      this.dofDepthEntity.setEulerAngles(rotation.x, rotation.y, rotation.z);
      this.dofDepthEntity.setLocalScale(scale, scale, scale);
    }
  }

  setDepthMeshDebugView(enabled: boolean): void {
    const pc = this.pc;
    if (!this.depthMeshEntity || !pc) return;
    const mat = enabled ? this.depthMeshDebugMaterial : this.depthMeshMaterial;
    if (!mat) return;
    this.depthMeshEntity.findComponents("render").forEach((render: any) => {
      render.renderStyle = pc.RENDERSTYLE_SOLID;
      render.meshInstances.forEach((mi: any) => {
        mi.material = mat;
      });
    });
  }

  setDepthMeshBias(bias: number): void {
    if (!this.depthMeshMaterial) return;
    this.depthMeshMaterial.depthBias = bias;
    this.depthMeshMaterial.slopeDepthBias = bias;
    this.depthMeshMaterial.update();
  }

  getDepthMeshAutoAlign(): { position: Vec3; scale: number } | null {
    const pc = this.pc;
    if (!this.depthMeshEntity || !pc) return null;

    const renders = this.depthMeshEntity.findComponents("render") as any[];
    if (renders.length === 0) return null;

    this.depthMeshEntity.setPosition(0, 0, 0);
    this.depthMeshEntity.setEulerAngles(0, 0, 0);
    this.depthMeshEntity.setLocalScale(1, 1, 1);

    const meshAabb = new pc.BoundingBox();
    let first = true;
    for (const render of renders) {
      for (const mi of render.meshInstances) {
        if (first) {
          meshAabb.copy(mi.aabb);
          first = false;
        } else {
          meshAabb.add(mi.aabb);
        }
      }
    }

    if (first) return null;

    const meshCenter = meshAabb.center;
    const mhe = meshAabb.halfExtents;
    const meshRadius = Math.sqrt(mhe.x * mhe.x + mhe.y * mhe.y + mhe.z * mhe.z);

    if (meshRadius < 1e-6) return null;

    const scale = this.splatRadius / meshRadius;
    const position: Vec3 = {
      x: this.splatCenter.x - meshCenter.x * scale,
      y: this.splatCenter.y - meshCenter.y * scale,
      z: this.splatCenter.z - meshCenter.z * scale,
    };

    return { position, scale };
  }

  setSceneYaw(yawRad: number): void {
    this.sceneYawDeg = yawRad * (180 / Math.PI);
  }

  setOrthoView(axis: "top" | "bottom" | "front" | "back" | "left" | "right" | null): void {
    const pc = this.pc;
    if (!this.cameraEntity || !pc) return;
    const cam = this.cameraEntity.camera;

    if (axis === null) {
      cam.projection = pc.PROJECTION_PERSPECTIVE;
      cam.fov = this.savedFov;
      return;
    }

    this.savedFov = cam.fov;
    cam.projection = pc.PROJECTION_ORTHOGRAPHIC;
    cam.orthoHeight = this.splatRadius * 0.5;

    const c = this.splatCenter;
    const d = this.splatRadius * 2;
    const positions: Record<string, [number, number, number]> = {
      top:    [c.x, c.y + d, c.z],
      bottom: [c.x, c.y - d, c.z],
      front:  [c.x, c.y, c.z + d],
      back:   [c.x, c.y, c.z - d],
      right:  [c.x + d, c.y, c.z],
      left:   [c.x - d, c.y, c.z],
    };
    const eulers: Record<string, [number, number, number]> = {
      top:    [-90, 0, 0],
      bottom: [90, 0, 0],
      front:  [0, 0, 0],
      back:   [0, 180, 0],
      right:  [0, -90, 0],
      left:   [0, 90, 0],
    };

    const [px, py, pz] = positions[axis];
    const [ex, ey, ez] = eulers[axis];
    this.cameraEntity.setPosition(px, py, pz);
    this.cameraEntity.setEulerAngles(ex, ey, ez);
  }

  orthoZoom(deltaPixels: number): void {
    const pc = this.pc;
    if (!this.cameraEntity || !pc) return;
    const cam = this.cameraEntity.camera;
    if (cam.projection !== pc.PROJECTION_ORTHOGRAPHIC) return;
    const factor = Math.pow(1.001, deltaPixels);
    cam.orthoHeight = Math.max(0.1, Math.min(100, cam.orthoHeight * factor));
  }

  getCollisionClampFn():
    | ((origin: Vec3, dx: number, dy: number, dz: number) => Vec3)
    | null {
    return null;
  }

  setAutoRender(auto: boolean): void {
    if (this.app) this.app.autoRender = auto;
  }

  requestSingleFrame(): void {
    if (!this.app) return;
    this.app.renderNextFrame = true;
    this.app.tick();
  }

  async grabFrame(): Promise<ImageBitmap> {
    if (!this.canvas) throw new Error("No canvas");
    // createImageBitmap handles WebGPU presentation synchronisation —
    // it waits for the most recently submitted frame to be composited
    // before capturing pixels, unlike synchronous drawImage.
    return createImageBitmap(this.canvas);
  }

  setMaxPixelRatio(ratio: number): void {
    const device = (this.app as any)?.graphicsDevice;
    if (device) device.maxPixelRatio = ratio;
  }

  getMaxPixelRatio(): number {
    const device = (this.app as any)?.graphicsDevice;
    return device?.maxPixelRatio ?? 1;
  }

  resizeCanvas(width: number, height: number): void {
    if (!this.app || !this.canvas) return;
    this.resizeObserver?.disconnect();
    this.canvas.width = width;
    this.canvas.height = height;
    this.app.resizeCanvas(width, height);
    this.applyViewportCanvasStyle();
    if (this.cameraFrame) {
      this.cameraFrame.update();
    }
    this.syncBlurResolution(width, height);
    this.updateFovUniforms();
  }

  private syncBlurResolution(w: number, h: number): void {
    if (this.blurEntity?.enabled) {
      const mi = this.blurEntity.render.meshInstances[0];
      mi.material.setParameter("uResolution", [w, h]);
      mi.material.update();
    }
  }

  restoreCanvasToViewport(): void {
    if (!this.app || !this.canvas || !this.container) return;
    this.applyViewportCanvasStyle();
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w > 0 && h > 0) {
      this.app.resizeCanvas(w, h);
      this.applyViewportCanvasStyle();
      this.syncBlurResolution(w, h);
    }
    if (this.cameraFrame) {
      this.cameraFrame.update();
    }
    this.updateFovUniforms();
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.app && this.canvas) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          this.app.resizeCanvas(width, height);
          this.applyViewportCanvasStyle();
          this.syncBlurResolution(width, height);
          this.updateFovUniforms();
        }
      }
    });
    this.resizeObserver.observe(this.container);
  }

  getApp(): unknown {
    return this.app;
  }
}
