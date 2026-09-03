"""Generate the Sproutly launch-splash Lottie from the brand splash animation.

Reproduces `../assets/sproutly_animated_splash.html` as a Bodymovin/Lottie 5.x
file using only the most portable Lottie features (ellipse/rect/fill shapes with
keyframed layer transforms), so lottie-flutter renders it reliably:

  the stem grows up, the two leaves unfurl, the seed pops, dirt specks appear,
  then the whole sprout floats gently.

Writes: assets/lottie/sproutly_splash.json  (500x500, 60fps, 3.0s)

Coordinates follow the HTML's 60x140 "sprout box"; HTML_SCALE/OX/OY map that
box, centred, into the 500x500 Lottie canvas.
"""
import json
import os

FR = 60
DUR_F = 180              # 3.0s
W = H = 500

HTML_SCALE = 2.6
OX, OY = 172.0, 68.0     # top-left of the mapped 60x140 sprout box


def L(hx, hy):
    return [OX + HTML_SCALE * hx, OY + HTML_SCALE * hy]


def rgb(r, g, b):
    return [r / 255, g / 255, b / 255, 1]


STEM = rgb(200, 230, 201)   # #C8E6C9
LEAF_R = rgb(165, 214, 167)  # #A5D6A7
LEAF_L = rgb(129, 199, 132)  # #81C784
SEED = rgb(255, 152, 0)     # #FF9800

# Ease handles (approx CSS ease-out) for scalar/mult-dim keyframes.
EO_O = {"x": [0.2], "y": [0.0]}
EO_I = {"x": [0.2], "y": [1.0]}


def scale_in(t0, t1):
    return {"a": 1, "k": [
        {"t": t0, "s": [0, 0, 100], "o": EO_O, "i": EO_I},
        {"t": t1, "s": [100, 100, 100]},
    ]}


def pop_in(t0, tmid, t1):
    return {"a": 1, "k": [
        {"t": t0, "s": [0, 0, 100], "o": EO_O, "i": EO_I},
        {"t": tmid, "s": [130, 130, 100], "o": EO_O, "i": EO_I},
        {"t": t1, "s": [100, 100, 100]},
    ]}


def const(v):
    return {"a": 0, "k": v}


def group(shape, fill, op=100):
    return {
        "ty": "gr",
        "it": [
            shape,
            {"ty": "fl", "c": const(fill), "o": const(op), "r": 1},
            {"ty": "tr", "p": const([0, 0]), "a": const([0, 0]),
             "s": const([100, 100]), "r": const(0), "o": const(100)},
        ],
    }


def ellipse(cx, cy, w, h):
    return {"ty": "el", "p": const([cx, cy]), "s": const([w, h])}


def rect(cx, cy, w, h, r):
    return {"ty": "rc", "p": const([cx, cy]), "s": const([w, h]), "r": const(r)}


def layer(ind, name, shape, fill, pos, *, rot=0, scale, op=100, parent=1):
    return {
        "ddd": 0, "ind": ind, "ty": 4, "nm": name, "parent": parent,
        "sr": 1, "ip": 0, "op": DUR_F, "st": 0, "bm": 0,
        "ks": {
            "o": const(op),
            "r": const(rot),
            "p": const(pos),
            "a": const([0, 0]),
            "s": scale,
        },
        "shapes": [group(shape, fill)],
    }


# --- Geometry (HTML sprout-box coords) -------------------------------------

# Stem: base at (30,140), grows to (30,40); width 3.5, origin bottom.
stem_base = L(30, 140)
stem_h = (140 - 40) * HTML_SCALE
stem_w = 3.5 * HTML_SCALE
stem = layer(
    2, "stem", rect(0, -stem_h / 2, stem_w, stem_h, stem_w / 2), STEM,
    stem_base, scale=scale_in(18, 66),  # 0.3s .. 1.1s
)

# Leaf-R: box 40x24 at (26,8), origin left-centre (26,20), rotate -35.
lr_pivot = L(26, 20)
lr_center = L(46, 20)  # ellipse centre before rotation
lr_off = [lr_center[0] - lr_pivot[0], lr_center[1] - lr_pivot[1]]
leaf_r = layer(
    3, "leaf-r", ellipse(lr_off[0], lr_off[1], 40 * HTML_SCALE, 24 * HTML_SCALE),
    LEAF_R, lr_pivot, rot=-35, scale=scale_in(66, 96),  # 1.1s .. 1.6s
)

# Leaf-L: box 34x20 at (-6,35), origin right-centre (28,45), rotate 30.
ll_pivot = L(28, 45)
ll_center = L(11, 45)
ll_off = [ll_center[0] - ll_pivot[0], ll_center[1] - ll_pivot[1]]
leaf_l = layer(
    4, "leaf-l", ellipse(ll_off[0], ll_off[1], 34 * HTML_SCALE, 20 * HTML_SCALE),
    LEAF_L, ll_pivot, rot=30, scale=scale_in(84, 114),  # 1.4s .. 1.9s
)

# Seed: 14x14 centred at (39,5), popIn.
seed_c = L(39, 5)
seed = layer(
    5, "seed", ellipse(0, 0, 14 * HTML_SCALE, 14 * HTML_SCALE), SEED,
    seed_c, scale=pop_in(96, 110, 120),  # 1.6s .. 2.0s
)

# Dirt specks below the base.
dirt_defs = [
    (6, "dirt-1", L(28, 148), 8, 0.5, 120),
    (7, "dirt-2", L(31, 150), 6, 0.3, 126),
    (8, "dirt-3", L(25, 149), 6, 0.4, 132),
]
dirt_layers = []
for ind, nm, c, d, op_frac, t0 in dirt_defs:
    dirt_layers.append(layer(
        ind, nm, ellipse(0, 0, d * HTML_SCALE, d * HTML_SCALE), STEM,
        c, scale=pop_in(t0, t0 + 10, t0 + 18), op=int(op_frac * 100),
    ))

# Null root: gentle float after everything settles.
root = {
    "ddd": 0, "ind": 1, "ty": 3, "nm": "sprout-root", "sr": 1,
    "ip": 0, "op": DUR_F, "st": 0, "bm": 0,
    "ks": {
        "o": const(100), "r": const(0), "a": const([0, 0]), "s": const([100, 100]),
        "p": {"a": 1, "k": [
            {"t": 120, "s": [0, 0], "o": EO_O, "i": EO_I},
            {"t": 150, "s": [0, -8], "o": EO_O, "i": EO_I},
            {"t": 180, "s": [0, 0]},
        ]},
    },
}

anim = {
    "v": "5.9.6", "fr": FR, "ip": 0, "op": DUR_F, "w": W, "h": H,
    "nm": "Sproutly Splash", "ddd": 0, "assets": [],
    "layers": [seed, leaf_l, leaf_r, stem, *dirt_layers, root],
}

out = os.path.join(os.path.dirname(__file__), "..", "assets", "lottie", "sproutly_splash.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(anim, f, separators=(",", ":"))
print("wrote", os.path.normpath(out), os.path.getsize(out), "bytes")
