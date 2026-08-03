#!/usr/bin/env python3
"""Simulation du rendu e-ink : 16 niveaux de gris + tramage Floyd-Steinberg.

C'est l'etape de verite du POC. Ce que montre cette image est proche de ce
que la liseuse affichera : les gris moyens en aplat marbrent, les traits
fins se fragmentent, les degrades se transforment en bandes.
"""
import sys, pathlib
import numpy as np
from PIL import Image

LEVELS = 16

def floyd_steinberg(a, levels=LEVELS):
    a = a.astype(np.float32).copy()
    h, w = a.shape
    step = 255.0 / (levels - 1)
    for y in range(h):
        for x in range(w):
            old = a[y, x]
            new = np.round(old / step) * step
            a[y, x] = new
            err = old - new
            if x + 1 < w:            a[y, x + 1] += err * 7 / 16
            if y + 1 < h:
                if x > 0:            a[y + 1, x - 1] += err * 3 / 16
                a[y + 1, x] += err * 5 / 16
                if x + 1 < w:        a[y + 1, x + 1] += err * 1 / 16
    return np.clip(a, 0, 255).astype(np.uint8)

def simulate(src, dst):
    im = Image.open(src).convert('L')
    a = np.array(im)
    # Le e-ink a une plage dynamique reduite : le blanc n'est jamais pur,
    # le noir jamais total. On compresse pour voir le contraste reel.
    a = (a.astype(np.float32) / 255.0 * (0.93 - 0.06) + 0.06) * 255.0
    out = floyd_steinberg(a)
    Image.fromarray(out).save(dst)
    print('e-ink', dst)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        p = pathlib.Path(p)
        simulate(p, p.with_name(p.stem + '-eink.png'))
