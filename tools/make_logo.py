"""Draw the Quindecim mark as clean vector shapes and write it into the logo files.

Usage: python3 tools/make_logo.py

The mark (126 x 126) is a blue ring, a green mountain with a spiral cut out of it, and a red sun. The earlier mark was
traced from an image, so its edges wobbled when shown large. Here every shape is built from smooth curves:
  - ring and sun: circles;
  - mountain: one half drawn with a few cubic curves and mirrored (the mountain is symmetric about x = 63); its base
    follows a circle around the ring's centre;
  - spiral: three half circles joined end to end (each turn a little wider), a band 6 wide with round ends. Its edges
    are circles too (the centre line's radius plus and minus 3), so the band is exact at any size. It is a hole in the
    mountain (even-odd fill), so whatever is behind the logo shows through, as before.

Writes assets/brand/quindecim-mark.svg and favicon.svg, and replaces the mark inside assets/brand/quindecim-lockup.svg
(the wordmark there is kept as it is).
"""
import math, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLUE, GREEN, RED = "#1D4FA8", "#2E7A57", "#B9431C"
f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
pt = lambda x, y: f"{f(x)} {f(y)}"

# ---------- mountain ----------
CX, CY, BASE_R = 63.0, 63.0, 45.5       # the base is an arc of this circle (the ring's centre)
BASE_Y = 78.8                           # where the slopes meet the base
base_dx = math.sqrt(BASE_R ** 2 - (BASE_Y - CY) ** 2)
APEX = (63.0, 31.1)
# The right half, from the apex down to the right corner of the base: cubic segments (c1, c2, end).
RIGHT = [
    ((64.6, 31.1), (65.8, 31.9), (66.6, 33.4)),        # round top of the central peak
    ((69.4, 39.0), (73.6, 49.6), (76.6, 55.2)),        # its right flank
    ((77.8, 57.5), (79.0, 59.4), (80.8, 59.4)),        # into the right saddle
    ((83.6, 59.4), (86.8, 54.6), (90.4, 54.6)),        # up to the right shoulder
    ((92.4, 54.6), (93.8, 55.9), (95.2, 57.9)),        # over the shoulder
    ((98.8, 63.2), (103.4, 71.0), (CX + base_dx, BASE_Y)),   # down the right slope to the base
]
mirror = lambda p: (2 * CX - p[0], p[1])


def mountain():
    d = [f"M{pt(*APEX)}"]
    for c1, c2, end in RIGHT:
        d.append(f"C{pt(*c1)} {pt(*c2)} {pt(*end)}")
    # the base: along the circle, under the spiral, to the left corner
    left_corner = (CX - base_dx, BASE_Y)
    d.append(f"A{f(BASE_R)} {f(BASE_R)} 0 0 1 {pt(*left_corner)}")
    # the left half: the right half mirrored, walked back up to the apex
    starts = [APEX] + [seg[2] for seg in RIGHT[:-1]]
    for (c1, c2, _end), start in reversed(list(zip(RIGHT, starts))):
        d.append(f"C{pt(*mirror(c2))} {pt(*mirror(c1))} {pt(*mirror(start))}")
    return "".join(d) + "Z"


# ---------- spiral ----------
# Centre line: three half circles, traversed anticlockwise on screen (angles in degrees, y pointing down), each
# starting where the last one ended, all joining on the line y = 84 with a vertical tangent.
W = 6.0                                 # band width
ARCS = [  # (centre x, centre y, radius, from angle, to angle)
    (64.3, 84.0, 5.7, 20.0, -180.0),    # innermost turn, from its end inside up over the top to the left
    (69.3, 84.0, 10.7, 180.0, 0.0),     # under the bottom to the right
    (63.6, 84.0, 16.4, 360.0, 183.0),   # over the top to the left, ending in the tail
]
at = lambda cx, cy, r, a: (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))


def arc_to(cx, cy, r, a0, a1):
    """SVG arc commands along a circle from angle a0 to a1 (split so no piece is 180 degrees or more)."""
    out, n = [], max(1, math.ceil(abs(a1 - a0) / 150))
    sweep = 1 if a1 > a0 else 0         # increasing angle = clockwise on screen = sweep 1
    for i in range(1, n + 1):
        a = a0 + (a1 - a0) * i / n
        out.append(f"A{f(r)} {f(r)} 0 0 {sweep} {pt(*at(cx, cy, r, a))}")
    return out


def spiral():
    h = W / 2
    first, last = ARCS[0], ARCS[-1]
    d = [f"M{pt(*at(first[0], first[1], first[2] + h, first[3]))}"]
    for cx, cy, r, a0, a1 in ARCS:                      # outer edge, inside to the tail
        d += arc_to(cx, cy, r + h, a0, a1)
    cx, cy, r, a0, a1 = last                            # round end of the tail
    d.append(f"A{f(h)} {f(h)} 0 0 0 {pt(*at(cx, cy, r - h, a1))}")
    for cx, cy, r, a0, a1 in reversed(ARCS):            # inner edge, back from the tail to the inside
        d += arc_to(cx, cy, r - h, a1, a0)
    cx, cy, r, a0, a1 = first                           # round inner end
    d.append(f"A{f(h)} {f(h)} 0 0 0 {pt(*at(cx, cy, r + h, a0))}")
    return "".join(d) + "Z"


def mark_shapes(indent):
    return "\n".join(indent + s for s in [
        f'<circle cx="63" cy="63" r="57.75" fill="none" stroke="{BLUE}" stroke-width="10.5"/>',
        f'<path fill="{GREEN}" fill-rule="evenodd" d="{mountain()}{spiral()}"/>',
        f'<circle cx="87.75" cy="37.25" r="9.75" fill="{RED}"/>',
    ])


mark = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 126 126" width="126" height="126">\n'
        '  <title>Quindecim</title>\n' + mark_shapes("  ") + "\n</svg>\n")
for path in ["assets/brand/quindecim-mark.svg", "favicon.svg"]:
    (ROOT / path).write_text(mark)
    print("wrote", path)

lockup = ROOT / "assets/brand/quindecim-lockup.svg"
text = lockup.read_text()
new, n = re.subn(r'(<g id="mark" transform="scale\(0\.380952\)">\n).*?(\n  </g>)',
                 lambda m: m.group(1) + mark_shapes("    ") + m.group(2), text, count=1, flags=re.S)
assert n == 1, "mark group not found in the lockup"
lockup.write_text(new)
print("updated the mark in", lockup.relative_to(ROOT))
