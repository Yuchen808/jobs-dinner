# Paint the shape-only mesh with vertex colours projected from the front / side / back reference crops.
# usage: python paint.py mesh.glb painted.glb [front_sign]
import sys
import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
front_sign = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0  # +1 if the model faces +Z

mesh = trimesh.load(src, force="mesh")
v = mesh.vertices.copy()
n = mesh.vertex_normals.copy()
print("bounds", mesh.bounds)
v[:, 2] *= front_sign; n[:, 2] *= front_sign; v[:, 0] *= front_sign; n[:, 0] *= front_sign


def view(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    fg = (im.min(axis=2) < 232)
    fg = ndimage.binary_opening(fg, iterations=2)
    lab, k = ndimage.label(fg)
    if k > 1:  # keep the biggest blob
        sizes = ndimage.sum(fg, lab, range(1, k + 1))
        fg = lab == (1 + int(np.argmax(sizes)))
    inner = ndimage.binary_erosion(fg, iterations=3)
    idx = ndimage.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    filled = im[idx[0], idx[1]]  # background replaced by nearest inside colour
    ys, xs = np.where(fg)
    return filled, (xs.min(), xs.max(), ys.min(), ys.max())


def sample(img_box, horiz, y):
    img, (x0, x1, y0, y1) = img_box
    ymin, ymax = v[:, 1].min(), v[:, 1].max()
    scale = (y1 - y0) / (ymax - ymin)
    row = y1 - (y - ymin) * scale
    col = (x0 + x1) / 2 + horiz * scale
    row = np.clip(np.round(row).astype(int), 0, img.shape[0] - 1)
    col = np.clip(np.round(col).astype(int), 0, img.shape[1] - 1)
    return img[row, col]



# Snap every vertex to one of a few flat part colours, so the importer does not have to guess.
PART = {"top": (16, 16, 20), "denim": (70, 96, 138), "skin": (214, 160, 128), "hair": (96, 90, 88), "shoe": (168, 164, 158)}
def snap(col, y):
    # all-black outfit: only skin, hair and shoes are told apart
    h = (y - y.min()) / (y.max() - y.min())
    r, g, b = col[:, 0], col[:, 1], col[:, 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    warm = (r > b + 22) & (r > g + 6) & (lum > 85)
    out = np.empty_like(col)
    out[:] = PART["top"]
    out[warm] = PART["skin"]
    out[(h > 0.80) & ~warm] = PART["hair"]
    out[(h < 0.085) & ~warm] = PART["shoe"]
    return out

front, side, back = view("front.png"), view("side.png"), view("back.png")
cx, cz = (v[:, 0].min() + v[:, 0].max()) / 2, (v[:, 2].min() + v[:, 2].max()) / 2
x, y, z = v[:, 0] - cx, v[:, 1], v[:, 2] - cz

c_front = sample(front, x, y)       # viewer looks down -Z: image right = +X
c_back = sample(back, -x, y)        # from behind: mirrored
c_side = sample(side, -z, y)        # the figure faces image-left, so +Z maps to the left

w_f = np.clip(n[:, 2], 0, 1) ** 2
w_b = np.clip(-n[:, 2], 0, 1) ** 2
w_s = np.abs(n[:, 0]) ** 2 * 0.6
# pick the strongest view per vertex (blending three photos muddies small features)
W = np.stack([w_f, w_b, w_s], axis=1)
pick = W.argmax(axis=1)
col = np.where(pick[:, None] == 0, c_front, np.where(pick[:, None] == 1, c_back, c_side))

col = snap(col, v[:, 1])
rgba = np.concatenate([col, np.full((len(col), 1), 255)], axis=1).astype(np.uint8)
mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=rgba)
mesh.export(dst)
print(len(mesh.vertices), "verts painted ->", dst)
