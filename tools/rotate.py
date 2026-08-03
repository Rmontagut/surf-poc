#!/usr/bin/env python3
"""Rotation d'un asset PNG, faite en amont du rendu.

Qt WebKit rogne les images transformees en CSS (une fleche pivotee a 45 deg
perd ses extremites). Pivoter en amont supprime la dependance au moteur de
rendu, et le reechantillonnage bicubique donne un bord plus propre en e-ink
que la transformation du navigateur.
"""
import sys
from PIL import Image

src, deg, dst = sys.argv[1], float(sys.argv[2]), sys.argv[3]
im = Image.open(src).convert('RGBA')
# CSS tourne dans le sens horaire, PIL dans le sens trigonometrique.
out = im.rotate(-deg, resample=Image.BICUBIC, expand=True)
out.save(dst)
print(f'{out.width} {out.height}')
