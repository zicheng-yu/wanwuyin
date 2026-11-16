"""Assemble the 万物印 demo video from screen recordings (CDP screencast), web renders and overlay PNGs.
python edit.py out_video.mp4            -> silent H.264 1920x1080@30 (prints total duration)
Shots are defined in SHOTS below; every output frame is a pure function of its time, so the
render is parallel and repeatable."""
import bisect, json, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image

FPS, W, H = 30, 1920, 1080
WORK = os.environ.get("WWY_WORK", "/tmp/wwy")  # recordings, renders and overlays live here (see README.md)
R, OV = f"{WORK}/renders", f"{WORK}/ov"


@lru_cache(maxsize=6)
def load(path):
    return Image.open(path).convert("RGB")


class Render:  # frame-accurate web render, 30 fps, 2880x1620
    def __init__(self, d):
        self.d = f"{R}/{d}"
        self.files = sorted(f for f in os.listdir(self.d) if f.endswith(".jpg"))
        self.size = Image.open(f"{self.d}/{self.files[0]}").size
        self.n = len(self.files)

    def frame(self, t):
        i = min(self.n - 1, max(0, int(round(t * FPS))))
        return load(f"{self.d}/{self.files[i]}")

    def px(self, x, y, w):  # crop given in fractions of the frame width/height
        return x * self.size[0], y * self.size[1], w * self.size[0]


class Cast:  # real-time screencast, timestamps relative to the "start" marker; crops in CSS px
    def __init__(self, d):
        self.d = d
        m = json.load(open(f"{d}/markers.json"))
        fr = json.load(open(f"{d}/frames.json"))
        self.t0 = next(x["t"] for x in m["markers"] if x["name"] == "start")
        self.mk = {x["name"]: x["t"] - self.t0 for x in m["markers"]}
        self.ts = [f["t"] - self.t0 for f in fr]
        self.files = [f["file"] for f in fr]
        self.size = Image.open(f"{d}/{self.files[0]}").size
        self.scale = self.size[0] / m["w"]  # screencast pixels per CSS px

    def frame(self, t):
        i = min(len(self.files) - 1, max(0, bisect.bisect_right(self.ts, t) - 1))
        return load(f"{self.d}/{self.files[i]}")

    def px(self, x, y, w):
        return x * self.scale, y * self.scale, w * self.scale


class Still:
    def __init__(self, path=None, color=(0, 0, 0)):
        self.img = Image.open(path).convert("RGB") if path else Image.new("RGB", (W, H), color)
        self.size = self.img.size

    def frame(self, t):
        return self.img

    def px(self, x, y, w):
        return x * self.size[0], y * self.size[1], w * self.size[0]


SRC = {}


def src(key):
    if key not in SRC:
        kind, arg = key.split(":", 1)
        SRC[key] = {"render": Render, "cast": Cast, "still": Still}[kind](arg) if kind != "black" else Still()
    return SRC[key]


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def shot(name, source, pieces, crop=None, xfade=0.0):
    """pieces: [(src_t0, src_t1, out_dur)], crop: [(u, x, y, w)] in the source's crop units (None = full)."""
    return {"name": name, "src": source, "pieces": pieces, "crop": crop, "xfade": xfade,
            "dur": sum(p[2] for p in pieces)}


def spin_crop(name, cw_min=0.55):
    b = json.load(open(f"{R}/bbox.json"))[f"spin_{name}"]
    bh = b[3] - b[1]
    cw = min(1.0, max(cw_min, bh / 0.5))
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    x0 = min(1 - cw, max(0, cx - cw / 2))
    y0 = min(1 - cw, max(0, cy - 0.40 * cw))
    return [(0, x0, y0, cw), (1, x0 + 0.01, y0 + 0.005, cw - 0.02)]  # tiny push-in


T_ = Cast(f"{WORK}/rec_text2")   # giraffe, text-to-3D
P_ = Cast(f"{WORK}/rec_photo2")  # bronze bell, photo-to-3D
tm, pm = T_.mk, P_.mk
FULL = [(0, 0, 0, 1600)]
STAGE_G = (745, 93, 810)
STAGE_P = (750, 185, 800)
WB_G = (230, 90, 1350)
WB_P = (230, 40, 1350)
FORM = (215, 95, 700)

SHOTS = [
    shot("A0", "black:", [(0, 0, 0.5)]),
    shot("A1", f"still:{OV}/black_1.png", [(0, 0, 3.0)], xfade=0.6),
    shot("A2", f"still:{OV}/black_2.png", [(0, 0, 3.6)], xfade=0.6),
    shot("A3", f"still:{OV}/black_3.png", [(0, 0, 4.2)], xfade=0.6),
]
for i, s in enumerate(["blue_whale", "saturn", "trex", "shark", "volcano", "ant", "yongzhong"]):
    SHOTS.append(shot(f"B{i}", f"render:spin_{s}", [(0, 2.2, 2.2)], crop=spin_crop(s), xfade=0.8 if i == 0 else 0.25))
SHOTS += [
    shot("C", f"still:{OV}/title.png", [(0, 0, 4.8)], xfade=0.6),
    shot("D", "render:triptych_orbit", [(0, 4.97, 5.0)], xfade=0.6),
    shot("E0", "render:elephant_anim", [(0, 0, 0.8)], xfade=0.5),
    shot("E", "render:elephant_anim", [(0, 13.3, 13.3)]),
    # --- the seal maker, text → Lux3D text-to-3D (real screencast)
    shot("F1", f"cast:{WORK}/rec_text2", [(1.5, tm["workbench"] + 0.1, 1.6)], crop=FULL, xfade=0.5),
    shot("F2", f"cast:{WORK}/rec_text2", [(tm["workbench"] + 0.1, tm["submit"] - 0.1, 5.0)],
         crop=[(0, 0, 0, 1600), (0.18, *FORM), (0.62, *FORM), (0.92, 215, 300, 700), (1, 215, 300, 700)]),
    shot("F3", f"cast:{WORK}/rec_text2", [(tm["submit"] - 0.1, tm["submit"] + 2.3, 2.4)],
         crop=[(0, 215, 300, 700), (0.6, *WB_G), (1, *WB_G)]),
    shot("F4", f"cast:{WORK}/rec_text2", [(tm["submit"] + 2.3, tm["landed"] - 2.2, 4.0)], crop=[(0, *WB_G)]),
    shot("F5", f"cast:{WORK}/rec_text2", [(tm["landed"] - 2.2, tm["landed"] + 0.3, 2.5)],
         crop=[(0, *WB_G), (0.5, *STAGE_G), (1, *STAGE_G)]),
    shot("F6", f"cast:{WORK}/rec_text2", [(tm["flip"] - 0.2, tm["flip"] + 3.8, 4.0)], crop=[(0, *STAGE_G)]),
    shot("F7", f"cast:{WORK}/rec_text2", [(tm["rub"] - 0.1, tm["rubbed"] + 0.3, 5.4)], crop=[(0, *STAGE_G)]),
    # --- photo → Lux3D image-to-3D
    shot("G1", f"cast:{WORK}/rec_photo2", [(pm["photo_pick"] - 0.2, pm["submit"] + 0.3, 5.4)],
         crop=[(0, 215, 40, 700), (0.4, 215, 40, 700), (0.8, 215, 420, 700), (1, 215, 420, 700)], xfade=0.5),
    shot("G2", f"cast:{WORK}/rec_photo2", [(pm["submit"] + 0.3, pm["landed"] - 2.4, 3.4)],
         crop=[(0, 215, 420, 700), (0.25, *WB_P), (1, *WB_P)]),
    shot("G3", f"cast:{WORK}/rec_photo2", [(pm["landed"] - 2.4, pm["flip"] + 3.6, 6.2)],
         crop=[(0, *WB_P), (0.35, *STAGE_P), (1, *STAGE_P)]),
    shot("G4", f"cast:{WORK}/rec_photo2", [(pm["rubbed"] - 1.7, pm["rubbed"] + 0.2, 1.9)], crop=[(0, *STAGE_P)], xfade=0.3),
    # --- Lux3D material transfer, the growing collection, end card
    shot("H", "render:materials_orbit", [(0, 5.97, 6.0)], xfade=0.5),
    shot("I", "render:set_orbit", [(0, 8.97, 9.0)], xfade=0.5),
    shot("J", f"still:{OV}/end.png", [(0, 0, 7.5)], xfade=0.8),
    shot("K", "black:", [(0, 0, 0.9)], xfade=0.9),
]

# timeline
t = 0.0
for s in SHOTS:
    s["start"] = t - s["xfade"]
    s["end"] = s["start"] + s["dur"]
    t = s["end"]
TOTAL = t
S = {s["name"]: s for s in SHOTS}


def at(name, off=0.0, end=False):
    s = S[name]
    return (s["end"] if end else s["start"]) + off


# overlays: (png, start, end); fades are 0.3 s
OVS = [("top_untouchable", at("B0", 0.3), at("B1", -0.1, True))]
for i, s in enumerate(["blue_whale", "saturn", "trex", "shark", "volcano", "ant", "yongzhong"]):
    OVS.append((f"big_{s}", at(f"B{i}", 0.25), at(f"B{i}", -0.05, True)))
OVS += [
    ("cap_triptych", at("D", 0.5), at("D", -0.2, True)),
    ("badge_render", at("D", 0.4), at("E", -0.1, True)),
    ("cap_e1", at("E0", 0.4), at("E", 2.75)),
    ("cap_e2", at("E", 2.85), at("E", 6.3)),
    ("cap_e3", at("E", 6.4), at("E", 9.5)),
    ("cap_e4", at("E", 9.6), at("E", -0.15, True)),
    ("badge_rec", at("F1", 0.4), at("G4", -0.1, True)),
    ("cap_m1", at("F1", 0.4), at("F2", -0.2, True)),
    ("cap_m2", at("F3", 0.1), at("F4", -0.1, True)),
    ("speed_m", at("F4", 0.05), at("F4", -0.05, True)),
    ("cap_m3", at("F5", 0.2), at("F5", -0.05, True)),
    ("cap_m4", at("F6", 0.1), at("F6", -0.1, True)),
    ("cap_m5", at("F7", 0.2), at("F7", -0.2, True)),
    ("cap_p1", at("G1", 0.3), at("G1", -0.1, True)),
    ("cap_p2", at("G2", 0.05), at("G2", -0.05, True)),
    ("speed_p", at("G2", 0.05), at("G2", -0.05, True)),
    ("cap_p3", at("G3", 1.6), at("G4", -0.2, True)),
    ("cap_mat", at("H", 0.4), at("H", -0.2, True)),
    ("badge_render", at("H", 0.3), at("I", -0.2, True)),
    ("cap_set", at("I", 0.4), at("I", -0.3, True)),
]
FADE = 0.3
OVDATA = {}


def overlay(name):
    if name not in OVDATA:
        im = np.asarray(Image.open(f"{OV}/{name}.png").convert("RGBA")).astype(np.float32) / 255
        ys, xs = np.nonzero(im[..., 3] > 0.003)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        OVDATA[name] = (y0, y1, x0, x1, im[y0:y1, x0:x1, :3], im[y0:y1, x0:x1, 3:4])
    return OVDATA[name]


def shot_frame(s, tau):
    # map output time inside the shot to source time
    acc = 0.0
    src_t = s["pieces"][-1][1]
    for (a, b, d) in s["pieces"]:
        if tau <= acc + d or (a, b, d) == s["pieces"][-1]:
            k = 0.0 if d <= 0 else min(1.0, max(0.0, (tau - acc) / d))
            src_t = a + (b - a) * k
            break
        acc += d
    so = src(s["src"])
    img = so.frame(src_t)
    crop = s["crop"]
    if crop is None and img.size == (W, H):
        return np.asarray(img, dtype=np.float32)
    if crop is None:
        x, y, w = 0, 0, img.size[0]
    else:
        u = tau / s["dur"] if s["dur"] else 0
        if len(crop) == 1 or u <= crop[0][0]:
            x, y, w = so.px(*crop[0][1:])
        else:
            x, y, w = so.px(*crop[-1][1:])
            for k0, k1 in zip(crop, crop[1:]):
                if k0[0] <= u <= k1[0]:
                    e = ease((u - k0[0]) / max(1e-6, k1[0] - k0[0]))
                    a, b = so.px(*k0[1:]), so.px(*k1[1:])
                    x, y, w = (a[i] + (b[i] - a[i]) * e for i in range(3))
                    break
    iw, ih = img.size
    w = min(w, iw, ih * 16 / 9)
    h = w * 9 / 16
    x = min(max(0.0, x), iw - w)
    y = min(max(0.0, y), ih - h)
    box = (x, y, x + w, y + h)
    out = img.resize((W, H), Image.BICUBIC, box=box, reducing_gap=2.0)
    return np.asarray(out, dtype=np.float32)


def render(n):
    T = n / FPS
    act = [s for s in SHOTS if s["start"] <= T < s["end"]]
    if not act:
        act = [SHOTS[-1]]
    frame = shot_frame(act[0], T - act[0]["start"])
    if len(act) > 1:
        nxt = act[1]
        k = ease((T - nxt["start"]) / max(1e-6, nxt["xfade"]))
        frame = frame * (1 - k) + shot_frame(nxt, T - nxt["start"]) * k
    for (name, a, b) in OVS:
        if a <= T <= b:
            alpha = min(1.0, (T - a) / FADE, (b - T) / FADE)
            y0, y1, x0, x1, rgb, al = overlay(name)
            al = al * alpha
            frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - al) + rgb * 255 * al
    return np.clip(frame, 0, 255).astype(np.uint8).tobytes()


if __name__ == "__main__":
    out = sys.argv[1]
    N = int(round(TOTAL * FPS))
    only = sys.argv[2] if len(sys.argv) > 2 else None  # "preview:<t1>,<t2>,..." writes stills instead
    if only and only.startswith("preview:"):
        for tt in only.split(":", 1)[1].split(","):
            n = int(float(tt) * FPS)
            Image.frombytes("RGB", (W, H), render(n)).resize((960, 540)).save(f"{out}_{tt}.jpg", quality=88)
        print("total", round(TOTAL, 2))
        sys.exit()
    for s in SHOTS:
        print(f"{s['name']:4s} {s['start']:7.2f} → {s['end']:7.2f}  ({s['dur']:.2f}s)")
    print("total", round(TOTAL, 2), "s,", N, "frames")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    with Pool(8) as pool:
        for i, buf in enumerate(pool.imap(render, range(N), chunksize=6)):
            ff.stdin.write(buf)
            if i % 300 == 0:
                print(f"frame {i}/{N}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", out)
