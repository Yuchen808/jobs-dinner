# Blender: give a generated figure mesh real materials by body part.
#   blender -b --python map_materials.py -- <folder> <host|visitor>
# Reads <folder>/mesh.glb and <folder>/{front,side,back}.png, writes <folder>/mapped.glb.
# Each vertex takes its colour from the reference view that can actually SEE it (ray test against the mesh), so a
# thigh in front of the torso no longer paints the torso. Colours are then classed into parts, cleaned up over the
# surface, and written as five materials: top, trousers, skin, hair, shoe.
import sys, os
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

folder, profile = sys.argv[sys.argv.index("--") + 1:][:2]
PARTS = ["top", "trousers", "skin", "hair", "shoe"]
BASE = {"top": (0.02, 0.02, 0.022), "trousers": (0.09, 0.14, 0.26) if profile == "host" else (0.025, 0.025, 0.028),
        "skin": (0.66, 0.4, 0.27), "hair": (0.14, 0.13, 0.13) if profile == "host" else (0.02, 0.018, 0.016),
        "shoe": (0.42, 0.4, 0.37) if profile == "host" else (0.015, 0.015, 0.015)}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(folder, "mesh.glb"))
obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = obj.data
M = obj.matrix_world
R3 = M.to_3x3()

nv = len(me.vertices)
co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
no = np.empty(nv * 3); me.vertices.foreach_get("normal", no); no = no.reshape(-1, 3)
Mn = np.array(M); Rn = np.array(R3)
w = co @ Mn[:3, :3].T + Mn[:3, 3]
wn = no @ Rn.T
# back to the file's own axes (Y up, figure facing +Z)
P = np.stack([w[:, 0], w[:, 2], -w[:, 1]], axis=1)
N = np.stack([wn[:, 0], wn[:, 2], -wn[:, 1]], axis=1)
N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12

nf = len(me.polygons)
tri = np.empty(nf * 3, dtype=np.int64); me.polygons.foreach_get("vertices", tri); tri = tri.reshape(-1, 3)
bvh = BVHTree.FromPolygons([Vector(p) for p in P], [tuple(int(i) for i in t) for t in tri])


def load(name):
    im = bpy.data.images.load(os.path.join(folder, name + ".png"))
    im.colorspace_settings.name = "Non-Color"
    wpx, hpx = im.size
    a = np.empty(wpx * hpx * 4, dtype=np.float32); im.pixels.foreach_get(a)
    a = (a.reshape(hpx, wpx, 4)[::-1, :, :3] * 255.0)  # top row first
    fg = a.min(axis=2) < 232
    ys, xs = np.where(fg)
    return a, fg, (xs.min(), xs.max(), ys.min(), ys.max())


views = {"front": load("front"), "side": load("side"), "back": load("back")}
ymin, ymax = P[:, 1].min(), P[:, 1].max()
cx = (P[:, 0].min() + P[:, 0].max()) / 2
cz = (P[:, 2].min() + P[:, 2].max()) / 2
H = (P[:, 1] - ymin) / (ymax - ymin)


def sample(view, horiz):
    img, fg, (x0, x1, y0, y1) = views[view]
    sc = (y1 - y0) / (ymax - ymin)
    row = np.clip(np.round(y1 - (P[:, 1] - ymin) * sc).astype(int), 0, img.shape[0] - 1)
    col = np.clip(np.round((x0 + x1) / 2 + horiz * sc).astype(int), 0, img.shape[1] - 1)
    return img[row, col], fg[row, col]


cam = {"front": (np.array([0, 0, 1.0]), P[:, 0] - cx), "back": (np.array([0, 0, -1.0]), -(P[:, 0] - cx)),
       "side": (np.array([1.0, 0, 0]), -(P[:, 2] - cz))}
best = np.full(nv, -1.0)
rgb = np.zeros((nv, 3), dtype=np.float32)
known = np.zeros(nv, dtype=bool)
for name, (d, horiz) in cam.items():
    colr, fg = sample(name, horiz)
    facing = N @ d
    cand = np.where((facing > 0.12) & fg & (facing > best))[0]
    dv = Vector(d)
    seen = np.zeros(len(cand), dtype=bool)
    for k, i in enumerate(cand):
        o = Vector(P[i] + N[i] * 0.004)
        seen[k] = bvh.ray_cast(o, dv)[0] is None
    ok = cand[seen]
    rgb[ok] = colr[ok]; best[ok] = facing[ok]; known[ok] = True
    print(name, "candidates", len(cand), "visible", int(seen.sum()), flush=True)
# his far side (-X) was never photographed: borrow the side view, mirrored, where nothing better exists
colr, fg = sample("side", -(P[:, 2] - cz))
far = (~known) & (N[:, 0] < -0.3) & fg
rgb[far] = colr[far]; known[far] = True

r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
lab = np.full(nv, -1, dtype=np.int64)
if profile == "host":
    warm = (r > b + 25) & (r > g + 8) & (lum > 90)
    blue = (b > r + 12) & (lum > 45)
    dark = lum < 70
    lab[known] = 4
    lab[known & dark] = 0
    lab[known & blue] = 1
    lab[known & blue & (H > 0.58)] = 0
    lab[known & warm] = 2
    head = H > 0.80
    lab[known & head & ~warm] = 3
    lab[known & ~dark & ~blue & ~warm & (H > 0.42) & ~head] = 2
    lab[known & (lab == 0) & (H < 0.3)] = 1  # nothing black below the knee: that is trouser in shadow
else:
    warm = (r > b + 22) & (r > g + 6) & (lum > 85)
    lab[known] = 0
    lab[known & (H < 0.52)] = 1
    lab[known & warm] = 2
    lab[known & (H > 0.80) & ~warm] = 3
    lab[known & (H < 0.085) & ~warm] = 4

# Hands: the projected photos do not line up with the mesh well enough at the hands (their colour landed on the
# forearms), so hands are found from the shape instead: the forward-most stretch of the arms, between waist and neck.
band = (H > 0.5) & (H < 0.8)
reach = 0.36 if profile == "host" else 0.26
hand = band & (P[:, 2] > P[band, 2].max() - reach)
stray = (lab == 2) & (H < 0.8) & ~hand
lab[stray & (H >= 0.52)] = 0
lab[stray & (H < 0.52)] = 1 if profile == "visitor" else 4
lab[hand] = 2
print("hand vertices", int(hand.sum()), flush=True)

# Visitor's head, by shape rather than by photo colour. The photos put shadow, glasses and ear tones in the wrong
# places (hair on the cheek and jaw, skin on the back of the head), so on the head the rule is geometric:
#   below the ear tops  : front of the head is skin (cheeks, jaw, ears), the back is hair (nape)
#   eye-to-brow band    : photo colour decides, but only on the front; everything else is hair
#   above that          : hair
if profile == "visitor":
    hb = H > 0.8
    zc = (P[hb, 2].min() + P[hb, 2].max()) / 2            # middle of the head, front to back
    z = P[:, 2]
    low = (H >= 0.81) & (H < 0.90)
    lab[low & (z > zc - 0.03)] = 2
    lab[low & (z <= zc - 0.03)] = 3
    mid = (H >= 0.90) & (H < 0.935)
    lab[mid & ~((lab == 2) & (z > zc + 0.03))] = 3
    lab[H >= 0.935] = 3
    print("visitor head: centre z", round(float(zc), 3), flush=True)

# per face: majority of its three vertices
fl = np.full(nf, -1, dtype=np.int64)
L = lab[tri]
for p in range(5):
    fl[((L == p).sum(axis=1) >= 2)] = p
one = (fl < 0) & (L.max(axis=1) >= 0)
fl[one] = L[one].max(axis=1)

# face neighbours across shared edges
e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
e.sort(axis=1)
key = e[:, 0] * nv + e[:, 1]
fid = np.tile(np.arange(nf), 3)
slot = np.repeat(np.arange(3), nf)
order = np.argsort(key, kind="stable")
ks, fs, ss = key[order], fid[order], slot[order]
same = ks[:-1] == ks[1:]
nb = np.full((nf, 3), -1, dtype=np.int64)
a, bb = np.where(same)[0], np.where(same)[0] + 1
nb[fs[a], ss[a]] = fs[bb]
nb[fs[bb], ss[bb]] = fs[a]

for _ in range(400):  # grow known labels into the faces nobody saw
    unk = np.where(fl < 0)[0]
    if not len(unk): break
    nl = np.where(nb[unk] >= 0, fl[np.maximum(nb[unk], 0)], -1)
    take = nl.max(axis=1)
    if (take >= 0).sum() == 0: break
    fl[unk] = take
fl[fl < 0] = 0
for _ in range(12):  # remove specks: a face outvoted by two neighbours takes their label
    nl = np.where(nb >= 0, fl[np.maximum(nb, 0)], -1)
    for p in range(5):
        flip = ((nl == p).sum(axis=1) >= 2) & (fl != p)
        fl[flip] = p

me.materials.clear()
for name in PARTS:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*BASE[name], 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    me.materials.append(m)
me.polygons.foreach_set("material_index", fl.astype(np.int32))
me.update()
print("faces per part", {PARTS[p]: int((fl == p).sum()) for p in range(5)}, flush=True)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(folder, "mapped.glb"), export_format="GLB", use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(folder, "mapped.blend"))
print("MAPPED_OK", flush=True)
