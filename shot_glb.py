# Blender: render grey "clay" check views of every .glb in a folder (whole figure, and a close view of the top third).
#   blender -b --python shot_glb.py -- <folder> [more .glb files ...]
import sys, os, math, glob
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
files = sorted(glob.glob(os.path.join(glob.escape(args[0]), "*.glb"))) + args[1:]   # escape: the path has [04] in it
outdir = os.path.join(args[0], "shots"); os.makedirs(outdir, exist_ok=True)

for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    if os.path.dirname(os.path.abspath(f)) != os.path.abspath(args[0]):
        name = "ref-" + os.path.basename(os.path.dirname(os.path.abspath(f))) + "__" + name
    if os.path.exists(os.path.join(outdir, name + "-whole.png")) and os.path.exists(os.path.join(outdir, name + "-close.png")):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"; sh.color_type = "SINGLE"; sh.single_color = (0.78, 0.76, 0.72)
    sh.show_cavity = True; sh.cavity_type = "BOTH"; sh.show_shadows = False; sh.show_specular_highlight = True
    sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.2, 0.2, 0.22)
    sc.view_settings.view_transform = "Standard"
    for o in objs:
        for p in o.data.polygons: p.use_smooth = True
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    mid = (lo + hi) / 2; size = max(hi - lo)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"
    def shoot(tag, centre, scale, ang, w, h):
        d = Vector((math.sin(ang), -math.cos(ang), 0.22)).normalized()
        cam.data.ortho_scale = scale
        cam.location = centre + d * size * 3
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.filepath = os.path.join(outdir, f"{name}-{tag}.png")
        bpy.ops.render.render(write_still=True)
    a = math.radians(-32)
    shoot("whole", mid, size * 1.12, a, 520, 620)
    top = Vector((mid.x, mid.y, hi.z - (hi.z - lo.z) * 0.2))
    shoot("close", top, size * 0.5, a, 520, 520)
    print("SHOT", name, flush=True)
print("SHOTS_DONE")
