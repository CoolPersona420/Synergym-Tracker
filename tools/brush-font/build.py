"""Paints every glyph with the brush and writes the font: public/fonts/synergym-brush.woff2.

Run: python3 tools/brush-font/build.py   (needs shapely, fonttools, brotli, numpy)
"""
import os
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
from glyphs import GLYPHS, J  # noqa: E402

SLANT = 17          # degrees of lean added to the upright drawings
SPACE = 230
HEAVY, LIGHT = 66, 28
CAP_LIGHT = 1.45    # capitals are pressed harder on their upstrokes
WIDE = 1.22         # the drawings are a little narrow for a heavy brush: widen them before painting
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'fonts', 'synergym-brush.woff2')


def dot(x, y, r, seed):
    """A dab of the brush: pressed in and pulled a little down to the right, like a teardrop."""
    return stroke([(x - 0.35 * r, y + 0.55 * r), (x + 0.35 * r, y - 0.55 * r)], heavy=r, light=r * 0.9, dry=0, seed=seed,
                  land=0.75, lift=0.35, land_len=12, lift_len=r * 1.1)


def corners(pts):
    """Split a path at its marked corners; the corner point ends one segment and starts the next."""
    segs, cur = [], []
    for p in pts:
        cur.append(p[:2])
        if len(p) > 2 and p[2]:
            segs.append(cur)
            cur = [p[:2]]
    segs.append(cur)
    return [s for s in segs if len(s) > 1]


def tail(part, adv):
    """The stroke that leaves the letter at the join height, carried on into a dry-brush tail."""
    if isinstance(part, tuple) and part and part[0] == 'dot':
        return part
    pts, opt = (part if isinstance(part, tuple) else (part, {}))
    if tuple(pts[-1][:2]) != (adv, J):
        return part
    return (list(pts) + [(adv + dx, J + dy) for dx, dy in TAIL], {**opt, 'dry': 1.0, 'dry_len': 150, 'lift': 0.3, 'lift_len': 60})


def fina_ok(ch):
    return ch.islower() and any(not (isinstance(p, tuple) and p and p[0] == 'dot') and
                                tuple((p[0] if isinstance(p, tuple) else p)[-1][:2]) == (GLYPHS[ch][0], J)
                                for p in GLYPHS[ch][1])


def scale_of(ch):
    """Lowercase sits tall against the capitals, as in brush lettering; everything is widened for the heavy brush."""
    if ch.islower():
        return WIDE * 1.1, 1.1
    if ch.isupper() or ch.isdigit():
        return WIDE * 0.95, 0.95
    return WIDE, 1.0


TAIL = [(56, 60), (116, 150)]   # a word's last letter sweeps on to the right and runs dry, like the m in the reference
TAIL_ADV = 70


def paint(ch, fina=False):
    adv, parts = GLYPHS[ch]
    sx, sy = scale_of(ch)
    if fina:
        parts = [tail(p, adv) for p in parts]
        adv += TAIL_ADV
    shapes = []
    for i, part in enumerate(parts):
        seed = ord(ch) * 31 + i
        if isinstance(part, tuple) and part and part[0] == 'dot':
            x, y, r = part[1:]
            shapes.append(dot(x * sx, y * sy, r * HEAVY / 46, seed))
            continue
        pts, opt = (part if isinstance(part, tuple) else (part, {}))
        kw = {'heavy': HEAVY, 'light': LIGHT * (CAP_LIGHT if ch.isupper() else 1), 'seed': seed, 'dry': 0, **opt}
        if 'heavy' in opt or 'light' in opt:      # options are given against a 46/8 brush: keep their proportions
            kw['heavy'] = opt.get('heavy', 46) * HEAVY / 46
            kw['light'] = min(opt.get('light', 8) * LIGHT / 8, kw['heavy'] * 0.8)
        for k, seg in enumerate(corners(pts)):    # a sharp corner: the brush stops, turns, and goes on
            kw2 = dict(kw, seed=seed * 7 + k)
            if k > 0:
                kw2.update(land=0.8, land_len=14)
            if k < len(corners(pts)) - 1:
                kw2.update(lift=0.8, lift_len=14, dry=0)
            shapes.append(stroke([(x * sx, y * sy) for x, y in seg], **kw2))
    shape = unary_union(shapes)
    shape = shape.buffer(5, quad_segs=4).buffer(-5, quad_segs=4)       # close hairline slivers where passes overlap
    shape = unary_union([Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area > 900]) for p in polygons(shape)])
    shape = affinity.skew(shape, xs=SLANT, origin=(0, 0))
    return round(adv * sx), shape.simplify(1.0, preserve_topology=True).buffer(0)


def polygons(shape):
    if shape.is_empty:
        return []
    return list(shape.geoms) if isinstance(shape, MultiPolygon) else [shape]


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
        poly = orient(poly, sign=-1.0)            # TrueType: outer rings clockwise, holes counter-clockwise
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
    for ch in GLYPHS:
        adv, shape = paint(ch)
        n = name_of(ch)
        order.append(n)
        cmap[ord(ch)] = n
        glyf[n] = glyph(shape)
        xmin = int(round(shape.bounds[0])) if not shape.is_empty else 0
        metrics[n] = (adv, xmin)
    finals = [ch for ch in GLYPHS if fina_ok(ch)]
    for ch in finals:
        adv, shape = paint(ch, fina=True)
        n = name_of(ch) + '.fina'
        order.append(n)
        glyf[n] = glyph(shape)
        metrics[n] = (adv, int(round(shape.bounds[0])))
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=880, descent=-320)
    fb.setupNameTable({'familyName': 'Synergym Brush', 'styleName': 'Regular',
                       'uniqueFontIdentifier': 'Synergym Brush Regular', 'fullName': 'Synergym Brush',
                       'psName': 'SynergymBrush-Regular', 'version': 'Version 1.000',
                       'copyright': 'Drawn for Synergym, 2026'})
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-320, sTypoLineGap=0, usWinAscent=920, usWinDescent=360,
                sxHeight=400, sCapHeight=720, fsType=0)
    fb.setupPost(italicAngle=-SLANT)
    fb.font['head'].macStyle = 0
    # the tail only where a word ends: at a space or the end of the text, not before a letter or punctuation
    rest = ' '.join(n for n in order if n not in ('.notdef', 'space') and not n.endswith('.fina'))
    addOpenTypeFeaturesFromString(fb.font, f"""
@low = [{' '.join(name_of(c) for c in finals)}];
@fin = [{' '.join(name_of(c) + '.fina' for c in finals)}];
@more = [{rest}];
feature calt {{ ignore sub @low' @more; sub @low' by @fin; }} calt;
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
