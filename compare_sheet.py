"""Lay the TRELLIS comparison renders out as labelled contact sheets.
  C:\\AI\\ComfyUI\\venv\\Scripts\\python.exe compare_sheet.py
Reads trellis-compare/results.json and trellis-compare/shots/*.png, writes trellis-compare/sheet-*.png."""
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "trellis-compare"); S = os.path.join(D, "shots")
R = json.load(open(os.path.join(D, "results.json")))
REF = {"host": ("ref-seated__mesh", os.path.join(HERE, "seated", "front.png")),
       "visitor": ("ref-visitor__mesh", os.path.join(HERE, "visitor", "front.png")),
       "standing": ("ref-figure__mesh", os.path.join(HERE, "figure", "front.png"))}
NOTE = {"A": "default: 512, heun 12+12 steps, guidance 7.5, seed 12345", "B": "seed 7", "C": "25+25 steps", "D": "guidance 5",
        "E": "guidance 10", "F": "light clean-up: 512 remesh, 100k faces", "G": "1024 cascade", "H": "euler, 12+12 steps",
        "I": "euler, 8+8 steps", "J": "model kept on GPU + euler 8 + light clean-up", "K": "same as J, seed 7 (model already loaded)"}
try:
    F1 = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22); F2 = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 17)
except OSError:
    F1 = F2 = ImageFont.load_default()
CW, HW, HC, LAB, PAD = 400, 477, 400, 96, 14      # cell width, whole height, close height, label height, gap


def cell(title, lines, whole, close):
    c = Image.new("RGB", (CW, LAB + HW + HC), (24, 24, 28)); d = ImageDraw.Draw(c)
    d.text((10, 8), title, font=F1, fill=(240, 232, 210))
    for i, t in enumerate(lines): d.text((10, 38 + i * 21), t, font=F2, fill=(170, 165, 150))
    for img, y, h in ((whole, LAB, HW), (close, LAB + HW, HC)):
        if img and os.path.exists(img):
            im = Image.open(img).convert("RGB"); im.thumbnail((CW, h))
            c.paste(im, ((CW - im.width) // 2, y + (h - im.height) // 2))
        else:
            d.text((10, y + 10), "(no render)", font=F2, fill=(200, 90, 80))
    return c


def sheet(name, image_key, letters, with_ref=True):
    cells = []
    src = REF[image_key][1]
    inp = Image.new("RGB", (CW, LAB + HW + HC), (24, 24, 28)); d = ImageDraw.Draw(inp)
    d.text((10, 8), "input image", font=F1, fill=(240, 232, 210)); d.text((10, 38), os.path.relpath(src, HERE), font=F2, fill=(170, 165, 150))
    im = Image.open(src).convert("RGB"); im.thumbnail((CW, HW)); inp.paste(im, ((CW - im.width) // 2, LAB + (HW - im.height) // 2))
    cells.append(inp)
    if with_ref:
        r = REF[image_key][0]
        cells.append(cell("Hunyuan3D-2 (earlier)", ["what the scene uses now", "shape only, ~57 s"], os.path.join(S, r + "-whole.png"), os.path.join(S, r + "-close.png")))
    for key, rec in R.items():
        ik, var = key.split("__")
        if ik != image_key or var[0] not in letters: continue
        info = f"{rec.get('seconds', '?')} s   {rec.get('vertices', 0) // 1000}k verts" if rec.get("ok") else "FAILED: " + rec.get("error", "")[:38]
        cells.append(cell(var, [NOTE.get(var[0], ""), info], os.path.join(S, key + "-whole.png"), os.path.join(S, key + "-close.png")))
    W = len(cells) * (CW + PAD) + PAD
    out = Image.new("RGB", (W, LAB + HW + HC + 2 * PAD), (8, 8, 10))
    for i, c in enumerate(cells): out.paste(c, (PAD + i * (CW + PAD), PAD))
    p = os.path.join(D, name + ".png"); out.save(p); print(p, out.size, len(cells), "cells")


sheet("sheet-1-host-quality", "host", "ABCDEG")
sheet("sheet-2-host-speed", "host", "AFHIJK", with_ref=False)
sheet("sheet-3-visitor", "visitor", "ABCDEFG")
sheet("sheet-4-standing", "standing", "ABCDEFG")
