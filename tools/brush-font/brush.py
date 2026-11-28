"""The brush: turns a pen path into a painted stroke, the way a loaded sumi brush lays ink.

A path is a list of points (font units, y up) that a smooth curve passes through. Along it the brush is a soft,
slightly flattened tip whose size follows pressure: heavy on downstrokes, light on upstrokes, landing lightly at the
start and lifting off at the end. The stroke is the union of the brush's prints. Then the brush runs dry: fine fibre
gaps follow the stroke, starting part way along and widening towards its end, as bristles stop leaving ink.
"""
import math
import random

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

NIB_ANGLE = math.radians(-32)   # the tip is flattened along this angle, for a little calligraphic contrast
NIB_FLAT = 0.55                 # its short axis, as a share of the long one


def spline(points, step=5.0):
    """Centripetal Catmull-Rom through the points, sampled about every `step` units."""
    P = np.array(points, float)
    if len(P) == 1:
        return P
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        def nxt(t, a, b):
            return t + max(np.linalg.norm(b - a), 1e-6) ** 0.5
        t0 = 0.0; t1 = nxt(t0, p0, p1); t2 = nxt(t1, p1, p2); t3 = nxt(t2, p2, p3)
        n = max(3, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(P[-2])
    return np.array(out)


def pressure(path, heavy, light, land=0.28, lift=0.12, land_len=26, lift_len=46):
    """Half-width along the path: heavy going down, light going up, tapered where the brush lands and lifts."""
    d = np.diff(path, axis=0, append=path[-1:] + (path[-1:] - path[-2:-1]))
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    down = np.clip(-d[:, 1], 0, 1) ** 0.75          # 1 straight down, 0 sideways or up
    r = light + (heavy - light) * down
    k = 9                                              # ease the changes so the weight flows
    r = np.convolve(np.pad(r, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    L = s[-1] or 1
    a = np.clip(s / land_len, 0, 1); b = np.clip((L - s) / lift_len, 0, 1)
    r *= (land + (1 - land) * np.sin(a * math.pi / 2)) * (lift + (1 - lift) * np.sin(b * math.pi / 2))
    return r, s, d


def tip(x, y, r):
    """The brush's print at one point: a flattened ellipse turned to the nib angle."""
    t = np.linspace(0, 2 * math.pi, 18, endpoint=False)
    ex, ey = r * np.cos(t), r * NIB_FLAT * np.sin(t)
    c, s = math.cos(NIB_ANGLE), math.sin(NIB_ANGLE)
    return np.column_stack([x + ex * c - ey * s, y + ex * s + ey * c])


def wobble(n, seed, amount=0.07, length=18):
    """Slow, smooth variation in the brush's load, so edges are never machine-perfect."""
    rnd = np.random.default_rng(seed)
    w = rnd.normal(0, 1, n + 2 * length)
    w = np.convolve(w, np.hanning(2 * length + 1), mode='same')[length:length + n]
    return 1 + amount * w / (np.abs(w).max() or 1)


def stroke(points, heavy=46, light=8, dry=0.0, seed=0, dry_len=None, **kw):
    """One painted stroke, dry-brush fibres included."""
    rnd = random.Random(seed)
    path = spline(points)
    r, s, d = pressure(path, heavy, light, **kw)
    r = r * wobble(len(r), seed)
    hulls = []
    for i in range(len(path) - 1):
        a = tip(*path[i], r[i]); b = tip(*path[i + 1], r[i + 1])
        hulls.append(Polygon(np.vstack([a, b])).convex_hull)
    shape = unary_union(hulls)
    L = s[-1]
    if dry > 0 and L > 120:
        # the brush runs dry as it lifts: on long strokes the last stretch parts into a few bristle streaks
        n = np.column_stack([-d[:, 1], d[:, 0]])     # the normal: across the stroke
        gaps, first = [], len(path)
        for off in sorted(rnd.uniform(-0.55, 0.55) for _ in range(rnd.choice([2, 2, 3]))):
            start = L - rnd.uniform(0.6, 1.0) * dry_len if dry_len else rnd.uniform(0.72, 0.88) * L
            idx = np.where(s >= start)[0]
            if len(idx) < 6:
                continue
            first = min(first, idx[0])
            pts = path[idx] + (n[idx] * (off * r[idx])[:, None])
            w1 = rnd.uniform(9, 15) * dry
            parts = np.array_split(np.arange(len(pts)), 5)   # widening as it goes
            for j, p in enumerate(parts):
                if len(p) < 2:
                    continue
                gaps.append(LineString(pts[p[0]:p[-1] + 2]).buffer(w1 * (j + 1) / 5, cap_style=2))
        if gaps:
            # ink laid earlier in the stroke stays where the dry stretch crosses it
            shape = unary_union([shape.difference(unary_union(gaps))] + hulls[:max(0, first - 3)])
    return shape
