import type { CollisionPolygon } from "./scene-preset";

const WALL_MARGIN = 0.005;

/**
 * Ray-casting point-in-polygon test on the XZ plane.
 * Returns true if the point (px, pz) is inside the polygon.
 */
function pointInPolygon(
  px: number,
  pz: number,
  polygon: { x: number; z: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x,
      zi = polygon[i].z;
    const xj = polygon[j].x,
      zj = polygon[j].z;
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Compute the closest point on a line segment to a given point, all in XZ.
 * Returns the squared distance and the closest point.
 */
function closestPointOnSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): { dist2: number; cx: number; cz: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-10) return { dist2: (px - ax) ** 2 + (pz - az) ** 2, cx: ax, cz: az };
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return { dist2: (px - cx) ** 2 + (pz - cz) ** 2, cx, cz };
}

/**
 * Push a point away from the nearest polygon edge if it's too close.
 * Returns the adjusted point.
 */
function pushAwayFromEdges(
  px: number,
  pz: number,
  polygon: { x: number; z: number }[]
): { x: number; z: number } {
  let pushX = 0;
  let pushZ = 0;

  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const seg = closestPointOnSegment(
      px, pz,
      polygon[j].x, polygon[j].z,
      polygon[i].x, polygon[i].z
    );
    const dist = Math.sqrt(seg.dist2);
    if (dist < WALL_MARGIN && dist > 1e-6) {
      const strength = (WALL_MARGIN - dist) / WALL_MARGIN;
      const nx = (px - seg.cx) / dist;
      const nz = (pz - seg.cz) / dist;
      pushX += nx * strength * WALL_MARGIN;
      pushZ += nz * strength * WALL_MARGIN;
    }
  }

  return { x: px + pushX, z: pz + pushZ };
}

export interface PolygonCollisionConfig {
  polygons: CollisionPolygon[];
  heightRange: { min: number; max: number };
}

/**
 * Push a point outside a polygon by projecting to the nearest edge + margin.
 */
function pushOutsidePolygon(
  px: number,
  pz: number,
  polygon: { x: number; z: number }[]
): { x: number; z: number } {
  let closestDist2 = Infinity;
  let closestCx = px;
  let closestCz = pz;

  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const seg = closestPointOnSegment(
      px, pz,
      polygon[j].x, polygon[j].z,
      polygon[i].x, polygon[i].z
    );
    if (seg.dist2 < closestDist2) {
      closestDist2 = seg.dist2;
      closestCx = seg.cx;
      closestCz = seg.cz;
    }
  }

  const dist = Math.sqrt(closestDist2);
  if (dist < 1e-6) {
    return { x: px + WALL_MARGIN, z: pz };
  }
  const nx = (px - closestCx) / dist;
  const nz = (pz - closestCz) / dist;
  return {
    x: closestCx + nx * WALL_MARGIN,
    z: closestCz + nz * WALL_MARGIN,
  };
}

/**
 * Creates a collision function that enforces:
 * 1. XZ position must remain inside boundary polygons
 * 2. XZ position must remain outside obstacle polygons
 * 3. Y position is clamped to the height range
 * 4. Camera is pushed away from polygon edges by WALL_MARGIN
 */
export function createPolygonCollisionFn(
  config: PolygonCollisionConfig
): (
  origin: { x: number; y: number; z: number },
  dx: number,
  dy: number,
  dz: number
) => { x: number; y: number; z: number } {
  const { polygons, heightRange } = config;
  const boundaries = polygons.filter((p) => (p.type ?? "boundary") === "boundary");
  const obstacles = polygons.filter((p) => p.type === "obstacle");

  return (origin, dx, dy, dz) => {
    let nx = origin.x + dx;
    let ny = origin.y + dy;
    let nz = origin.z + dz;

    ny = Math.max(heightRange.min, Math.min(heightRange.max, ny));

    if (boundaries.length === 0 && obstacles.length === 0) {
      return { x: nx, y: ny, z: nz };
    }

    // Boundary enforcement: must be inside at least one boundary polygon
    if (boundaries.length > 0) {
      let insideAny = false;
      for (const poly of boundaries) {
        if (pointInPolygon(nx, nz, poly.points)) {
          insideAny = true;
          const pushed = pushAwayFromEdges(nx, nz, poly.points);
          nx = pushed.x;
          nz = pushed.z;
          break;
        }
      }

      if (!insideAny) {
        let bestDist2 = Infinity;
        let bestX = origin.x;
        let bestZ = origin.z;

        for (const poly of boundaries) {
          const pts = poly.points;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const seg = closestPointOnSegment(nx, nz, pts[j].x, pts[j].z, pts[i].x, pts[i].z);
            if (seg.dist2 < bestDist2) {
              bestDist2 = seg.dist2;
              bestX = seg.cx;
              bestZ = seg.cz;
            }
          }
        }

        const edgeDist = Math.sqrt(bestDist2);
        if (edgeDist > 1e-6) {
          const pushX = (nx - bestX) / edgeDist;
          const pushZ = (nz - bestZ) / edgeDist;
          nx = bestX - pushX * WALL_MARGIN;
          nz = bestZ - pushZ * WALL_MARGIN;
        } else {
          nx = bestX;
          nz = bestZ;
        }

        let correctedInside = false;
        for (const poly of boundaries) {
          if (pointInPolygon(nx, nz, poly.points)) {
            correctedInside = true;
            break;
          }
        }
        if (!correctedInside) {
          nx = origin.x;
          nz = origin.z;
        }
      }
    }

    // Obstacle enforcement: must be outside all obstacle polygons
    for (const poly of obstacles) {
      if (pointInPolygon(nx, nz, poly.points)) {
        const pushed = pushOutsidePolygon(nx, nz, poly.points);
        if (!pointInPolygon(pushed.x, pushed.z, poly.points)) {
          nx = pushed.x;
          nz = pushed.z;
        } else {
          nx = origin.x;
          nz = origin.z;
        }
      }
    }

    return { x: nx, y: ny, z: nz };
  };
}

export { pointInPolygon };
