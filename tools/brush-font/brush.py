"""The brush: a flat, hard-pressed brush made of bristles, the way punk and street lettering is painted fast.

A path is a list of points (font units, y up) that a smooth curve passes through. The brush is a row of bristles held
at an angle (its flat edge), each with its own width, a little wander, and its own idea of when to land and when to
let go. Where a stroke starts, a few bristles touch down early as thin spikes; where it ends, some run dry and stop
short while others flick on past the stroke, so ends splinter into sharp prongs. A bristle can skip a stretch when the
brush moves fast, leaving a dry streak. The stroke is the union of the bristles' marks.
"""
import math
import random

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union


def spline(points, step=6.0):
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


def noise(n, rng, length=14):
    """Smooth random wander in [-1, 1], changing over about `length` samples."""
    w = rng.normal(0, 1, n + 4 * length)
    w = np.convolve(w, np.hanning(2 * length + 1), mode='same')[2 * length:2 * length + n]
    return w / (np.abs(w).max() or 1)


def extend(path, before, after):
    """Carry the path on straight past both ends, so bristles can land early and flick on late."""
    a = path[0] - path[min(3, len(path) - 1)]; a = a / (np.linalg.norm(a) or 1)
    b = path[-1] - path[max(-4, -len(path))]; b = b / (np.linalg.norm(b) or 1)
    head = [path[0] + a * d for d in np.arange(before, 0, -6.0)] if before > 0 else []
    tail = [path[-1] + b * d for d in np.arange(6.0, after + 6, 6.0)] if after > 0 else []
    return np.array(head + list(path) + tail), len(head)


def trace(pts, rad):
    """One bristle's mark: a line whose width follows `rad`, pointed where rad reaches zero."""
    if len(pts) < 2:
        return None
    d = np.gradient(pts, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    n = np.column_stack([-d[:, 1], d[:, 0]])
    poly = Polygon(np.vstack([pts + n * rad[:, None], (pts - n * rad[:, None])[::-1]]))
    return poly if poly.is_valid else poly.buffer(0)


def stroke(points, width=150, angle=34, bristles=13, seed=0, start=True, end=True, flick=1.0, skip=0.3):
    """One painted stroke. `start`/`end` say whether that end is free (it splinters) or a corner (it stays blunt)."""
    rng = np.random.default_rng(seed)
    rnd = random.Random(seed)
    W = width
    path = spline(points)
    pre, post = (0.45 * W if start else 0), (1.25 * W * flick if end else 0)
    path, k0 = extend(path, pre, post)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)]) - (np.sum(seg[:k0]) if k0 else 0)
    L = s[-1] - post                                   # where the drawn path itself ends
    m = len(path)
    load = 1 + 0.07 * noise(m, rng, 20)                # the hand presses a little more, a little less
    land = np.clip((s + 0.2 * W) / (0.55 * W), 0.72, 1) if start else np.ones(m)
    Ws = W * load * land
    phi = math.radians(angle) + math.radians(5) * noise(m, rng, 30)    # the brush turns a little in the hand
    e = np.column_stack([np.cos(phi), np.sin(phi)])   # along the brush's edge
    f = np.column_stack([-np.sin(phi), np.cos(phi)])  # across its thickness

    shapes = []
    for u in np.linspace(-1, 1, bristles) + rng.uniform(-0.05, 0.05, bristles):
        v = rng.uniform(-0.28, 0.28)
        r = W * rng.uniform(0.055, 0.095)
        pos = path + e * ((u + 0.05 * noise(m, rng, 12)) * Ws / 2)[:, None] + f * (v * Ws / 2)[:, None]
        outer = abs(u) > 0.55
        # where this bristle lands and lets go
        if start and rnd.random() < (0.4 if outer else 0.12):
            a = -rnd.uniform(0.05, 0.42) * W                # touches down early: a thin spike leading in
        else:
            a = rnd.uniform(0, 0.1) * W
        roll = rnd.random()
        if not end:
            b = L + rnd.uniform(-0.04, 0.08) * W
        elif roll < (0.3 if outer else 0.18):
            b = L - rnd.uniform(0.08, 0.45) * W            # runs dry and stops short
        elif roll < (0.62 if outer else 0.8):
            b = L + rnd.uniform(-0.05, 0.12) * W           # lifts with the brush
        else:
            b = L + rnd.uniform(0.3, 1.2) * W * flick      # flicks on past the stroke: a prong
        t_in = rnd.uniform(0.2, 0.45) * W if start else 0.08 * W
        t_out = (rnd.uniform(0.5, 0.95) if b > L + 0.2 * W else rnd.uniform(0.15, 0.4)) * W if end else 0.08 * W
        rad = r * np.sqrt(np.clip((s - a) / t_in, 0, 1) * np.clip((b - s) / t_out, 0, 1))
        # a fast brush skips: one stretch of this bristle leaves no ink
        if L > 2.2 * W and rnd.random() < skip * (1.3 if outer else 0.6):
            g0 = rnd.uniform(0.35, 0.8) * L
            g1 = g0 + rnd.uniform(0.12, 0.3) * L
            rad = rad * (1 - np.clip(np.minimum(s - g0, g1 - s) / (0.12 * W), 0, 1))
        idx = np.where(rad > 0.4)[0]
        for run in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1):   # each run of ink is its own mark
            if len(run) < 2:
                continue
            lo, hi = max(run[0] - 1, 0), min(run[-1] + 2, m)
            t = trace(pos[lo:hi], rad[lo:hi])
            if t is not None and not t.is_empty:
                shapes.append(t)
    return unary_union(shapes)
