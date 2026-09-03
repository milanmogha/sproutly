"""Generate the Sproutly app icon from the brand vector art.

The brand icon is a sprout on a green rounded square (see
`../assets/sproutly_icon_final.svg`). Rather than depend on a native SVG
rasteriser (cairo isn't available on this machine), this script redraws the
same primitives with Pillow — deterministic and dependency-light — and writes
the three layers flutter_launcher_icons consumes:

  assets/icon/app_icon.png            full-bleed green field + sprout (iOS + legacy)
  assets/icon/app_icon_background.png solid brand green   (adaptive background)
  assets/icon/app_icon_foreground.png sprout in safe zone (adaptive foreground)

Then run: `dart run flutter_launcher_icons`

Coordinates below are in the icon's "badge-local" space: the SVG's rounded
square spans (90,20)-(290,220), which we treat as a 200x200 box with its
origin at (0,0). The sprout group sits at (85,40) within that box.
"""
import math

from PIL import Image, ImageDraw

BASE = 1024          # output edge, px
SS = 4               # supersample factor for antialiasing
UNIT = 200           # badge-local edge, in SVG user units

# Brand palette (from sproutly_icon_final.svg)
GREEN = (46, 125, 50)     # #2E7D32  rounded-square field
DECO = (56, 142, 60)      # #388E3C  soft background blobs
STEM = (200, 230, 201)    # #C8E6C9
LEAF1 = (165, 214, 167)   # #A5D6A7
LEAF2 = (129, 199, 132)   # #81C784
SEED = (255, 152, 0)      # #FF9800

# Sprout group origin within the badge-local box.
GX, GY = 85.0, 40.0

# Fraction of the canvas the sprout occupies in the adaptive foreground.
# flutter_launcher_icons wraps the foreground in a further ~16% inset, so the
# on-screen size lands comfortably inside the circle/squircle mask.
FG_SCALE = 0.72


def _layer(size):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def _bezier(p0, c, p1, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]
        y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]
        pts.append((x, y))
    return pts


def _rot_ellipse(size, cx, cy, rx, ry, color, deg):
    """Draw a filled ellipse rotated `deg` degrees (SVG clockwise-positive)
    about its own centre, returned as its own RGBA layer of edge `size`."""
    pad = int(max(rx, ry) * 2 + 8)
    tile = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    m = pad / 2
    d.ellipse([m - rx, m - ry, m + rx, m + ry], fill=color + (255,))
    # SVG's positive rotation is clockwise on a y-down canvas; PIL rotates
    # counter-clockwise for positive angles, so negate to match.
    tile = tile.rotate(-deg, resample=Image.BICUBIC, expand=False)
    out = _layer(size)
    out.alpha_composite(tile, (int(cx - m), int(cy - m)))
    return out


def render_sprout(size):
    """Sprout (stem, leaves, seed, falling specks) on transparent, sized so the
    badge-local box maps onto `size`x`size`."""
    f = size / UNIT

    def P(x, y):  # sprout-group local -> pixel
        return ((GX + x) * f, (GY + y) * f)

    out = _layer(size)

    # Stem: two quadratic segments, stroked with round caps (emulated as a
    # dense run of filled dots).
    stem_pts = _bezier((0, 100), (0, 65), (0, 45)) + _bezier((0, 45), (0, 22), (14, 8))
    r = 2 * f  # stroke half-width (SVG stroke-width 4)
    sd = ImageDraw.Draw(out)
    for x, y in stem_pts:
        px, py = P(x, y)
        sd.ellipse([px - r, py - r, px + r, py + r], fill=STEM + (255,))

    # Leaves (rotated ellipses) and seed.
    lc = P(28, 2)
    out.alpha_composite(_rot_ellipse(size, lc[0], lc[1], 24 * f, 14 * f, LEAF1, -35))
    lc = P(-8, 34)
    out.alpha_composite(_rot_ellipse(size, lc[0], lc[1], 20 * f, 12 * f, LEAF2, 30))

    d = ImageDraw.Draw(out)
    sx, sy = P(28, -8)
    d.ellipse([sx - 7 * f, sy - 7 * f, sx + 7 * f, sy + 7 * f], fill=SEED + (255,))

    # Falling specks below the sprout.
    for x, y, rr, a in [(-2, 112, 5, 128), (10, 120, 3.5, 90), (-12, 118, 3.5, 102)]:
        spx, spy = P(x, y)
        speck = _layer(size)
        ImageDraw.Draw(speck).ellipse(
            [spx - rr * f, spy - rr * f, spx + rr * f, spy + rr * f],
            fill=STEM + (a,),
        )
        out.alpha_composite(speck)

    return out


def render_badge(size, rounded):
    """The full icon: green field (optionally rounded), soft blobs, sprout."""
    f = size / UNIT
    out = _layer(size)
    d = ImageDraw.Draw(out)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=44 * f, fill=GREEN + (255,))
    else:
        d.rectangle([0, 0, size, size], fill=GREEN + (255,))

    # Soft background blobs (badge-local centres 40,40 and 160,160).
    for cx, cy, rr, a in [(40, 40, 30, 90), (160, 160, 25, 76)]:
        blob = _layer(size)
        ImageDraw.Draw(blob).ellipse(
            [(cx - rr) * f, (cy - rr) * f, (cx + rr) * f, (cy + rr) * f],
            fill=DECO + (a,),
        )
        out.alpha_composite(blob)

    out.alpha_composite(render_sprout(size))
    return out


def _down(img):
    return img.resize((BASE, BASE), Image.LANCZOS)


def save(img, *path, opaque=False, bg=None):
    import os

    p = os.path.join(os.path.dirname(__file__), "..", *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if opaque:
        flat = Image.new("RGBA", img.size, (bg or GREEN) + (255,))
        flat.alpha_composite(img)
        flat.convert("RGB").save(p)
    else:
        img.save(p)
    print("wrote", os.path.normpath(p))


if __name__ == "__main__":
    N = BASE * SS

    # Full-bleed: green to the edges (iOS/legacy apply their own corner mask).
    full = _down(render_badge(N, rounded=False))
    save(full, "assets", "icon", "app_icon.png", opaque=True)

    # Adaptive background: solid brand green.
    bg = _down(render_badge(N, rounded=False))  # reuse blobs for subtle depth
    solid = Image.new("RGBA", bg.size, GREEN + (255,))
    save(solid, "assets", "icon", "app_icon_background.png", opaque=True)

    # Adaptive foreground: sprout only, shrunk into the mask-safe zone.
    sprout = render_sprout(N)
    box = sprout.getbbox()
    crop = sprout.crop(box)
    target = int(BASE * FG_SCALE)
    scale = target / max(crop.width, crop.height)
    crop = crop.resize(
        (max(1, int(crop.width * scale)), max(1, int(crop.height * scale))),
        Image.LANCZOS,
    )
    fg = _layer(BASE)
    fg.alpha_composite(crop, ((BASE - crop.width) // 2, (BASE - crop.height) // 2))
    save(fg, "assets", "icon", "app_icon_foreground.png")
