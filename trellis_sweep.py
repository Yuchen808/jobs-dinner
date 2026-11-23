"""Run TRELLIS.2 on the same image with several settings, so the results can be compared side by side.

  C:\\AI\\ComfyUI\\venv\\Scripts\\python.exe trellis_sweep.py

Uses the imageto3d skill's script for talking to ComfyUI and only overrides node inputs per run. Each run writes
<out>/<image>__<variant>.glb; results.json records settings, seconds, vertex count, or the error.
"""
import glob, json, os, shutil, sys, time, urllib.request, urllib.error

sys.path.insert(0, os.path.expanduser(r"~\.claude\skills\imageto3d\scripts"))
import imageto3d as I

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "trellis-compare")
os.makedirs(OUT, exist_ok=True)

IMAGES = {                                  # white-background reference figures
    "host": os.path.join(HERE, "seated", "front.png"),
    "visitor": os.path.join(HERE, "visitor", "front.png"),
    "standing": os.path.join(HERE, "figure", "front.png"),
}
# name -> (workflow resolution, {NodeClass: {input: value}})
BASE = {}
VARIANTS = {
    "A-base-512":      (512, {}),
    "B-seed-7":        (512, {"Trellis2SparseGenerator": {"seed": 7}}),
    "C-steps-25":      (512, {"Trellis2SparseGenerator": {"sparse_structure_steps": 25}, "Trellis2ShapeGenerator": {"shape_steps": 25}}),
    "D-guidance-5":    (512, {"Trellis2SparseGenerator": {"sparse_structure_guidance_strength": 5.0}, "Trellis2ShapeGenerator": {"shape_guidance_strength": 5.0}}),
    "E-guidance-10":   (512, {"Trellis2SparseGenerator": {"sparse_structure_guidance_strength": 10.0}, "Trellis2ShapeGenerator": {"shape_guidance_strength": 10.0}}),
    "F-light-cleanup": (512, {"Trellis2ReconstructMeshWithQuad": {"resolution": 512}, "PrimitiveInt": {"value": 100000}}),
    "G-res-1024":      (1024, {}),
    # speed: fewer, cheaper steps (heun evaluates the model twice per step, euler once)
    "H-euler-12":      (512, {"Trellis2SparseGenerator": {"sparse_structure_sampler": "euler"}, "Trellis2ShapeGenerator": {"shape_sampler": "euler"}}),
    "I-euler-8":       (512, {"Trellis2SparseGenerator": {"sparse_structure_sampler": "euler", "sparse_structure_steps": 8},
                              "Trellis2ShapeGenerator": {"shape_sampler": "euler", "shape_steps": 8}}),
    # everything at once: model kept on the GPU, euler 8 steps, light clean-up
    "J-fastest":       (512, {"Trellis2LoadModel": {"low_vram": False, "keep_models_loaded": True},
                              "Trellis2SparseGenerator": {"sparse_structure_sampler": "euler", "sparse_structure_steps": 8},
                              "Trellis2ShapeGenerator": {"shape_sampler": "euler", "shape_steps": 8},
                              "Trellis2ReconstructMeshWithQuad": {"resolution": 512}, "PrimitiveInt": {"value": 100000}}),
    "K-fastest-again": (512, {"Trellis2LoadModel": {"low_vram": False, "keep_models_loaded": True},
                              "Trellis2SparseGenerator": {"sparse_structure_sampler": "euler", "sparse_structure_steps": 8, "seed": 7},
                              "Trellis2ShapeGenerator": {"shape_sampler": "euler", "shape_steps": 8},
                              "Trellis2ReconstructMeshWithQuad": {"resolution": 512}, "PrimitiveInt": {"value": 100000}}),
}
PLAN = [("host", v) for v in VARIANTS if v[0] < "H"] + [("visitor", v) for v in ("A-base-512", "C-steps-25", "G-res-1024")] + \
       [("standing", v) for v in ("A-base-512", "G-res-1024")] + \
       [("host", v) for v in VARIANTS if v[0] >= "H"]
LIMIT = {512: 420, 1024: 600}               # seconds before a run is interrupted and recorded as timed out

if not I.server_up():
    I.log("starting ComfyUI ..."); I.start_server()
info = I.get("/object_info", timeout=60)
results_path = os.path.join(OUT, "results.json")
results = json.load(open(results_path)) if os.path.exists(results_path) else {}


def run(image_key, variant):
    key = f"{image_key}__{variant}"
    dst = os.path.join(OUT, key + ".glb")
    if key in results and results[key].get("ok") and os.path.exists(dst):
        return
    res, overrides = VARIANTS[variant]
    src = IMAGES[image_key]
    in_name = f"sweep_{key}_{int(time.time())}.png"
    shutil.copyfile(src, os.path.join(I.COMFY, "input", in_name))
    api = I.workflow_to_api(json.load(open(I.WORKFLOWS[res], encoding="utf-8")), info)
    api[I.find_node(api, "Trellis2LoadImageWithTransparency")]["inputs"]["image"] = in_name
    api[I.find_node(api, "Trellis2LoadModel")]["inputs"]["pixal3d_multiview"] = False
    api[I.find_node(api, "Trellis2PreProcessImage")]["inputs"]["remove_background"] = True
    api[I.find_node(api, "Trellis2SparseGenerator")]["inputs"].update({"dino_lock": 0.0, "dino_substeps": 1, "seed": 12345})
    prefix = "sweep_" + key
    api[I.find_node(api, "PrimitiveString")]["inputs"]["value"] = prefix
    for cls, values in overrides.items():
        api[I.find_node(api, cls)]["inputs"].update(values)
    rec = {"image": image_key, "variant": variant, "res": res, "overrides": overrides, "ok": False}
    try:
        req = urllib.request.Request(I.URL + "/prompt", data=json.dumps({"prompt": api, "client_id": "sweep"}).encode(),
                                     headers={"Content-Type": "application/json"})
        pid = json.load(urllib.request.urlopen(req))["prompt_id"]
        t0 = time.time()
        while True:
            time.sleep(5)
            try: h = I.get(f"/history/{pid}", timeout=10).get(pid)
            except Exception: h = None
            if h:
                st = h.get("status", {})
                if st.get("status_str") == "error":
                    msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
                    rec["error"] = (msgs[0][1].get("exception_message", "") if msgs else "error")[:300]
                    break
                if st.get("completed"):
                    rec["ok"] = True; break
            if time.time() - t0 > LIMIT[res]:
                urllib.request.urlopen(urllib.request.Request(I.URL + "/interrupt", data=b"", method="POST"))
                rec["error"] = f"interrupted after {LIMIT[res]} s"; time.sleep(15); break
        rec["seconds"] = round(time.time() - t0)
        if rec["ok"]:
            time.sleep(2)
            new = sorted(glob.glob(os.path.join(I.COMFY, "output", prefix + "*.glb")), key=os.path.getmtime)
            if new:
                shutil.move(new[-1], dst)
                import trimesh
                m = trimesh.load(dst, force="mesh")
                rec.update(vertices=len(m.vertices), faces=len(m.faces), mb=round(os.path.getsize(dst) / 1e6, 1))
            else:
                rec["ok"] = False; rec["error"] = "no glb written"
    except Exception as e:
        rec["error"] = repr(e)[:300]
    results[key] = rec
    json.dump(results, open(results_path, "w"), indent=1)
    I.log(f"{key}: {'ok' if rec['ok'] else 'FAILED'} {rec.get('seconds', '?')} s {rec.get('vertices', '')} {rec.get('error', '')}")


for image_key, variant in PLAN:
    run(image_key, variant)
I.stop_server()
print("SWEEP_DONE")
