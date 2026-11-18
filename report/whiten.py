"""Turn the cream background of web renders (#EFE9DD) into white for the white-page report.

python whiten.py in.png out.png
Pixels whose colour is the cream background scaled by some brightness k (the background itself
and the ground shadows) become neutral grey 255*k, so the floor turns white and shadows stay soft
grey. Objects keep their colours: a pixel is only remapped when its chroma matches the cream and
it is about as bright as a shadow (k >= ~0.75)."""
import sys
import numpy as np
from PIL import Image

BG = np.array([239.0, 233.0, 221.0])
LUM = np.array([0.2126, 0.7152, 0.0722])


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def whiten(img):
    a = np.asarray(img.convert("RGB")).astype(np.float64)
    k = (a @ LUM) / (BG @ LUM)                       # brightness relative to the background
    expected = k[..., None] * BG                      # what a background/shadow pixel of that brightness looks like
    d = np.linalg.norm(a - expected, axis=-1) / (np.linalg.norm(expected, axis=-1) + 1e-6)
    w = smooth(0.06, 0.025, d) * smooth(0.70, 0.80, k)  # cream-coloured and shadow-bright
    grey = np.clip(255.0 * k, 0, 255)[..., None].repeat(3, axis=-1)
    out = a * (1 - w[..., None]) + grey * w[..., None]
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    out = whiten(im)
    if dst.lower().endswith((".jpg", ".jpeg")):
        out.save(dst, quality=92)
    else:
        out.save(dst, optimize=True)
