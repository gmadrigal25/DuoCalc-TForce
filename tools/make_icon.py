"""Draws icon.png: a plain calculator glyph on a dark tile. Swap in your own 512x512 PNG if you like."""
from PIL import Image, ImageDraw
import sys

S = 512
out = sys.argv[1] if len(sys.argv) > 1 else "icon.png"
img = Image.new("RGB", (S, S), (0, 0, 0))
d = ImageDraw.Draw(img)
# Dark grey tile background (iOS masks the corners itself)
for y in range(S):
    t = y / S
    c = int(58 - 30 * t)
    d.line([(0, y), (S, y)], fill=(c, c, c + 2))
cell, gap = 92, 16
x0 = (S - (4 * cell + 3 * gap)) // 2
y0 = (S - (4 * cell + 3 * gap)) // 2
for r in range(4):
    for col in range(4):
        x = x0 + col * (cell + gap)
        y = y0 + r * (cell + gap)
        if col == 3:
            fill = (255, 149, 0)
        elif r == 0:
            fill = (165, 165, 168)
        else:
            fill = (92, 92, 94)
        d.ellipse([x, y, x + cell, y + cell], fill=fill)
img.save(out)
print("wrote", out)
