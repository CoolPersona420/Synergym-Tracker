"""Paints every glyph with the brush and writes the font: public/fonts/synergym-brush.woff2.

Each letter is painted twice, with a different hand each time (the brush, its angle, the path wobble a little), and
the font alternates the two as you type, so a doubled letter never looks stamped. Each painting also sits a touch
off true, turned and lifted a little, the way hand lettering does.

Run: python3 tools/brush-font/build.py [out.woff2]   (needs shapely, fonttools, brotli, numpy)
"""
import os
import random
import sys

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(__file__))
from brush import stroke  # noqa: E402
from glyphs import GLYPHS  # noqa: E402

SLANT = 16            # degrees of lean added to the upright drawings
WIDTH = 188           # the brush's flat edge, in font units
LOWER_WIDTH = 0.86    # lowercase is painted with a slightly smaller press
ANGLE = 34            # the brush's edge against the horizontal
SPACE = 250
TRACK = 58            # air between painted letters
WIDEN = 1.2           # the drawings are widened for the heavy brush
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'fonts', 'synergym-brush.woff2')


def segments(pts):
    """Split a path at its marked corners: (points, starts free, ends free) for each piece."""
    segs, cur = [], []
    for p in pts:
        cur.append(tuple(p[:2]))
        if len(p) > 2 and p[2]:
            segs.append(cur)
            cur = [tuple(p[:2])]
    segs.append(cur)
    segs = [s for s in segs if len(s) > 1]
    return [(s, i == 0, i == len(segs) - 1) for i, s in enumerate(segs)]


def hook_of(parts):
    """The stroke that ends a lowercase letter going down onto the baseline, furthest right: it gets a flick."""
    best = None
    for p in parts:
        if isinstance(p, tuple):
            continue
        (x0, y0), (x1, y1) = p[-2][:2], p[-1][:2]
        if y1 <= 20 and (y0 - y1) > 2.5 * abs(x1 - x0) and (best is None or x1 > best[-1][0]):
            best = p
    return best


def paint(ch, variant=0):
    adv, parts = GLYPHS[ch]
    rnd = random.Random(ord(ch) * 101 + variant * 7919)
    width = WIDTH * (LOWER_WIDTH if ch.islower() else 1)
    shapes = []
    for i, part in enumerate(parts):
        seed = ord(ch) * 31 + i + variant * 100003
        if isinstance(part, tuple) and part and part[0] == 'dot':
            x, y = part[1:]
            x *= WIDEN
            shapes.append(stroke([(x - 26, y + 40), (x + 18, y - 32)], width=width * 0.92, seed=seed, flick=0.3, skip=0,
                                 bow=0))
            continue
        pts, opt = (part if isinstance(part, tuple) else (part, {}))
        jit = 9 if variant else 0              # the second hand doesn't trace the first exactly
        pts = [(p[0] * WIDEN * (1.06 if ch.isupper() else 1) + rnd.uniform(-jit, jit), p[1] + rnd.uniform(-jit, jit)) + tuple(p[2:]) for p in pts]
        if ch.islower() and part is hook_of(parts):
            x, y = pts[-1][:2]
            pts = pts + [(x + 58, y + 62)]     # hane: the last stem flicks up towards the next letter
        w = width * opt.get('width', 1)
        angle = ANGLE + rnd.uniform(-4, 4)
        for k, (seg, free_start, free_end) in enumerate(segments(pts)):
            shapes.append(stroke(seg, width=w, angle=angle, seed=seed * 7 + k, start=free_start, end=free_end))
    shape = unary_union(shapes)
    shape = shape.buffer(3, quad_segs=3).buffer(-3, quad_segs=3)      # close hairline slivers between bristles
    shape = unary_union([Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area > 350]) for p in polygons(shape)])
    # off true, like a hand: turned a degree or two, lifted or dropped a little
    adv = round(adv * WIDEN * (1.06 if ch.isupper() else 1))
    shape = affinity.rotate(shape, rnd.uniform(-1.8, 1.8), origin=(adv / 2, 300))
    shape = affinity.translate(shape, 0, rnd.uniform(-12, 12))
    shape = affinity.skew(shape, xs=SLANT, origin=(0, 0))
    return adv + TRACK, shape.simplify(1.2, preserve_topology=True).buffer(0)


def polygons(shape):
    if shape.is_empty:
        return []
    if isinstance(shape, Polygon):
        return [shape]
    return [g for g in getattr(shape, 'geoms', []) if isinstance(g, Polygon)]


def ring(pen, coords):
    pts = []
    for x, y in coords[:-1]:
        p = (int(round(x)), int(round(y)))
        if not pts or p != pts[-1]:
            pts.append(p)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()


def glyph(shape):
    pen = TTGlyphPen(None)
    for poly in polygons(shape):
        if poly.area < 40:                   # specks too small to see
            continue
        poly = orient(poly, sign=-1.0)       # TrueType: outer rings clockwise, holes counter-clockwise
        ring(pen, list(poly.exterior.coords))
        for hole in poly.interiors:
            ring(pen, list(hole.coords))
    return pen.glyph()


def name_of(ch):
    return 'space' if ch == ' ' else 'uni%04X' % ord(ch)


def build(out=OUT):
    order = ['.notdef', 'space']
    cmap = {32: 'space'}
    glyf = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (500, 0), 'space': (SPACE, 0)}
    for variant, suffix in ((0, ''), (1, '.alt')):
        for ch in GLYPHS:
            adv, shape = paint(ch, variant)
            n = name_of(ch) + suffix
            order.append(n)
            if not suffix:
                cmap[ord(ch)] = n
            glyf[n] = glyph(shape)
            metrics[n] = (adv, int(round(shape.bounds[0])) if not shape.is_empty else 0)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-330)
    fb.setupNameTable({'familyName': 'Synergym Brush', 'styleName': 'Regular',
                       'uniqueFontIdentifier': 'Synergym Brush Regular 2', 'fullName': 'Synergym Brush',
                       'psName': 'SynergymBrush-Regular', 'version': 'Version 2.000',
                       'copyright': 'Drawn for Synergym, 2026'})
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-330, sTypoLineGap=0, usWinAscent=960, usWinDescent=420,
                sxHeight=470, sCapHeight=720, fsType=0)
    fb.setupPost(italicAngle=-SLANT)
    fb.font['head'].macStyle = 0
    # alternate the two paintings: a letter right after another painted in the first hand takes the second
    base = ' '.join(name_of(c) for c in GLYPHS)
    alt = ' '.join(name_of(c) + '.alt' for c in GLYPHS)
    addOpenTypeFeaturesFromString(fb.font, f"""
@one = [{base}];
@two = [{alt}];
feature calt {{ sub @one @one' by @two; }} calt;
""")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ttf = out.replace('.woff2', '.ttf')
    fb.save(ttf)
    f = TTFont(ttf)
    f.flavor = 'woff2'
    f.save(out)
    os.remove(ttf)
    print(out, os.path.getsize(out), 'bytes,', len(order), 'glyphs')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else OUT)
