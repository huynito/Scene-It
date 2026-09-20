import c4d
import os
import random
import math

TARGET_POINT_COUNT = 2_000_000
OUTPUT_PATH = os.path.expanduser("~/Desktop/points3D_uniform.txt")


def get_selected_polygon_objects(doc):
    result = []
    for obj in doc.GetActiveObjects(c4d.GETACTIVEOBJECTFLAGS_CHILDREN):
        if obj.GetType() == c4d.Opolygon:
            result.append(obj)
    return result


def triangulate_polygon(poly):
    if poly.c == poly.d:
        return [(poly.a, poly.b, poly.c)]
    return [(poly.a, poly.b, poly.c), (poly.a, poly.c, poly.d)]


def triangle_area(p0, p1, p2):
    return 0.5 * (p1 - p0).Cross(p2 - p0).GetLength()


def random_barycentric():
    r1 = random.random()
    r2 = random.random()
    s = math.sqrt(r1)
    u = 1.0 - s
    v = r2 * s
    return u, v, 1.0 - u - v


def get_object_color(obj):
    for tag in obj.GetTags():
        if tag.GetType() == c4d.Ttexture:
            mat = tag.GetMaterial()
            if mat:
                c = mat[c4d.MATERIAL_COLOR_COLOR]
                if c:
                    return (int(c.x * 255), int(c.y * 255), int(c.z * 255))
    uc = obj[c4d.ID_BASEOBJECT_USECOLOR]
    if uc and uc != c4d.ID_BASEOBJECT_USECOLOR_OFF:
        dc = obj[c4d.ID_BASEOBJECT_COLOR]
        if dc:
            return (int(dc.x * 255), int(dc.y * 255), int(dc.z * 255))
    return (128, 128, 128)


def get_vertex_color_tag(obj):
    for tag in obj.GetTags():
        if tag.GetType() == c4d.Tvertexcolor:
            return tag
    return None


def sample_vertex_color(vc_tag, poly_idx, bary, fallback):
    try:
        data = vc_tag.GetDataAddressR()
        col = c4d.VertexColorTag.GetColor(data, None, None, poly_idx)
        u, v, w = bary
        r = u * col["a"].x + v * col["b"].x + w * col["c"].x
        g = u * col["a"].y + v * col["b"].y + w * col["c"].y
        b = u * col["a"].z + v * col["b"].z + w * col["c"].z
        return (int(max(0, min(255, r * 255))),
                int(max(0, min(255, g * 255))),
                int(max(0, min(255, b * 255))))
    except Exception:
        return fallback


def main():
    doc = c4d.documents.GetActiveDocument()
    if not doc:
        return

    objects = get_selected_polygon_objects(doc)
    if not objects:
        print("No polygon objects selected.")
        return

    print(f"Objects: {len(objects)}, Target: {TARGET_POINT_COUNT:,}")

    triangles = []
    for obj in objects:
        mg = obj.GetMg()
        pts = [mg * p for p in obj.GetAllPoints()]
        vc = get_vertex_color_tag(obj)
        fc = get_object_color(obj)
        for pi, poly in enumerate(obj.GetAllPolygons()):
            for tri in triangulate_polygon(poly):
                p0, p1, p2 = pts[tri[0]], pts[tri[1]], pts[tri[2]]
                a = triangle_area(p0, p1, p2)
                if a > 1e-10:
                    triangles.append((p0, p1, p2, a, vc, pi, fc))

    if not triangles:
        print("No valid triangles.")
        return

    total_area = sum(t[3] for t in triangles)
    print(f"Triangles: {len(triangles):,}, Area: {total_area:.2f} cm^2")

    out = []
    pid = 1
    for p0, p1, p2, area, vc, pi, fc in triangles:
        n = area / total_area * TARGET_POINT_COUNT
        ni = int(n)
        if random.random() < (n - ni):
            ni += 1
        for _ in range(ni):
            u, v, w = random_barycentric()
            pos = p0 * u + p1 * v + p2 * w
            col = sample_vertex_color(vc, pi, (u, v, w), fc) if vc else fc
            out.append((pid, pos.x, pos.y, pos.z, col[0], col[1], col[2]))
            pid += 1

    d = os.path.dirname(OUTPUT_PATH)
    if d and not os.path.exists(d):
        os.makedirs(d)

    with open(OUTPUT_PATH, "w") as f:
        f.write("# 3D point list with one line of data per point:\n")
        f.write("#   POINT3D_ID, X, Y, Z, R, G, B, ERROR, TRACK[] as (IMAGE_ID, POINT2D_IDX)\n")
        for pid, x, y, z, r, g, b in out:
            f.write(f"{pid} {x:.6f} {y:.6f} {z:.6f} {r} {g} {b} 0.0\n")

    print(f"Wrote {len(out):,} points to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
