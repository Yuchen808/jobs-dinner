# Blender: render two check views (front three-quarter, back three-quarter) of <folder>/mapped.blend
#   blender -b <folder>/mapped.blend --python shot.py -- <out_prefix>
import sys, math
import bpy
from mathutils import Vector

prefix = sys.argv[sys.argv.index("--") + 1]
sc = bpy.context.scene
obj = next(o for o in sc.objects if o.type == "MESH")
for m in obj.data.materials:
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    m.diffuse_color = tuple(bsdf.inputs["Base Color"].default_value)

sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading
sh.light = "STUDIO"; sh.color_type = "MATERIAL"; sh.show_cavity = True; sh.show_shadows = False
sc.render.resolution_x, sc.render.resolution_y = 900, 1100
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.55, 0.55, 0.55)
sc.view_settings.view_transform = "Standard"

corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
lo = Vector([min(c[i] for c in corners) for i in range(3)]); hi = Vector([max(c[i] for c in corners) for i in range(3)])
mid = (lo + hi) / 2; size = max(hi - lo)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = size * 1.15
# the figure faces -Y in Blender (glTF +Z)
for name, ang in (("front", math.radians(-35)), ("back", math.radians(145))):
    d = Vector((math.sin(ang), -math.cos(ang), 0.35)).normalized()
    cam.location = mid + d * size * 3
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{prefix}-{name}.png"
    bpy.ops.render.render(write_still=True)
print("SHOT_OK")
