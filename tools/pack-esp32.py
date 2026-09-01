#!/usr/bin/env python3
"""PNG 540x960 (portrait) -> framebuffer 4 bits/pixel 960x540 pour l'ecran
LilyGo T5 4.7" (epdiy). Deux sorties possibles :
  - .bin : le fichier brut que le firmware telecharge (259 200 octets)
  - .h   : un header C avec l'image embarquee (pour le firmware de test)

Format epdiy : 2 pixels par octet ; pixel pair -> quartet bas (v >> 4),
pixel impair -> quartet haut (v & 0xF0). 0x0 = noir, 0xF = blanc.

Usage :
  python3 tools/pack-esp32.py in.png out.bin
  python3 tools/pack-esp32.py in.png out.h --header surf_image
  [--rot 90|270]   rotation portrait -> paysage (defaut 270 ; si l'image
                   apparait a l'envers sur l'ecran, utiliser 90)
"""
import sys
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = {a.split()[0]: True for a in sys.argv[1:] if a.startswith('--')}
src, dst = args[0], args[1]
name = None
if '--header' in sys.argv:
    name = sys.argv[sys.argv.index('--header') + 1]
rot = 90 if '--rot' in sys.argv and sys.argv[sys.argv.index('--rot') + 1] == '90' else 270

im = Image.open(src).convert('L')
if im.size == (540, 960):
    im = im.transpose(Image.ROTATE_90 if rot == 90 else Image.ROTATE_270)
assert im.size == (960, 540), f'attendu 960x540 apres rotation, obtenu {im.size}'

W, H = im.size
px = im.load()
buf = bytearray(W * H // 2)
for y in range(H):
    for x in range(0, W, 2):
        a = px[x, y] >> 4        # pixel pair -> quartet bas
        b = px[x + 1, y] & 0xF0  # pixel impair -> quartet haut
        buf[(y * W + x) // 2] = b | a

if name:
    with open(dst, 'w') as f:
        f.write(f'// Genere par tools/pack-esp32.py depuis {src}\n')
        f.write('#pragma once\n#include <stdint.h>\n')
        f.write(f'const uint32_t {name}_width = {W};\n')
        f.write(f'const uint32_t {name}_height = {H};\n')
        f.write(f'const uint8_t {name}_data[{len(buf)}] = {{\n')
        for i in range(0, len(buf), 24):
            f.write(', '.join(f'0x{v:02X}' for v in buf[i:i + 24]) + ',\n')
        f.write('};\n')
else:
    with open(dst, 'wb') as f:
        f.write(bytes(buf))
print(f'{dst} : {W}x{H}, {len(buf)} octets, rotation {rot}')
