"""Draws icon.png: a Home Screen icon in the style of a modern iOS system icon (a dark pocket
calculator on a light tile), built from scratch with simple shapes.

Usage: python3 tools/make_icon.py [out.png]
"""
from PIL import Image, ImageDraw
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "icon.png"
SIZE = 512
SS = 4  # draw at 4x and scale down, for smooth edges
S = SIZE * SS


def px(v):
    return round(v * SS)


def vertical_gradient(w, h, top, bottom):
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g


def paste_shape(img, box, radius, fill_img):
    """Paste fill_img (sized to box) through a rounded-rectangle mask."""
    x0, y0, x1, y1 = box
    mask = Image.new("L", (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, x1 - x0 - 1, y1 - y0 - 1], radius=radius, fill=255)
    img.paste(fill_img, (x0, y0), mask)


img = vertical_gradient(S, S, (232, 232, 235), (206, 206, 210))  # light grey tile
d = ImageDraw.Draw(img)

# Calculator body, with a faint drop shadow
shadow = Image.new("L", (S, S), 0)
ImageDraw.Draw(shadow).rounded_rectangle(
    [px(122), px(70), px(390), px(452)], radius=px(42), fill=60
)
from PIL import ImageFilter  # noqa: E402

shadow = shadow.filter(ImageFilter.GaussianBlur(px(6)))
img.paste((150, 150, 155), (0, 0), shadow)

body = (px(122), px(64), px(390), px(448))
paste_shape(img, body, px(42), vertical_gradient(body[2] - body[0], body[3] - body[1], (36, 36, 38), (22, 22, 24)))

# Display window
screen = (px(150), px(92), px(362), px(182))
paste_shape(img, screen, px(14), vertical_gradient(screen[2] - screen[0], screen[3] - screen[1], (92, 92, 95), (76, 76, 79)))

LIGHT = (214, 214, 217)
ORANGE = (255, 149, 0)
R = 27  # button radius
cols = [177, 256, 335]
rows = [235, 314, 393]


def dot(cx, cy, colour):
    d.ellipse([px(cx - R), px(cy - R), px(cx + R), px(cy + R)], fill=colour)


for row, cy in enumerate(rows):
    for col, cx in enumerate(cols):
        if col == 2:
            dot(cx, cy, ORANGE)
        elif row < 2:
            dot(cx, cy, LIGHT)
# Wide key bottom left, spanning the first two columns
d.rounded_rectangle(
    [px(cols[0] - R), px(rows[2] - R), px(cols[1] + R), px(rows[2] + R)], radius=px(R), fill=LIGHT
)

img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT)
print("wrote", OUT)
