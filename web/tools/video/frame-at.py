"""python frameat.py <recdir> <marker> <offset_s> <out.jpg> [grid]  — frame nearest marker+offset, downscaled to CSS px with a 100px grid."""
import json, sys
from PIL import Image, ImageDraw
d, mk, off, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
grid = len(sys.argv) > 5
m = json.load(open(f"{d}/markers.json")); fr = json.load(open(f"{d}/frames.json"))
t = next(x["t"] for x in m["markers"] if x["name"] == mk) + off
f = min(fr, key=lambda x: abs(x["t"] - t))
im = Image.open(f"{d}/{f['file']}").convert("RGB").resize((m["w"], m["h"]))
if grid:
    dr = ImageDraw.Draw(im)
    for x in range(0, m["w"], 100): dr.line([(x, 0), (x, m["h"])], fill=(0, 160, 255), width=1); dr.text((x + 2, 2), str(x), fill=(0, 100, 255))
    for y in range(0, m["h"], 100): dr.line([(0, y), (m["w"], y)], fill=(0, 160, 255), width=1); dr.text((2, y + 2), str(y), fill=(0, 100, 255))
im.save(out, quality=85)
print(out, f["file"], round(f["t"] - t, 3))
