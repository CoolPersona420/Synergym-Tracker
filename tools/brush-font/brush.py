"""The brush: a Japanese brush painted fast, made of bristles.

A path is a list of points (font units, y up) that a smooth curve passes through. The brush is a row of bristles held
at an angle (its flat edge), each with its own width and a little wander. It lands pressed, runs full, and sweeps out
to a sharp point as it lifts; going fast, some bristles run dry and leave white streaks (kasure), and a few splay off
the tip as fine spikes. The stroke is the union of the bristles' marks.
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


def bowed(points, bow, rnd):
    """A hand never paints a ruler line: a short straight path gets a gentle curve."""
    P = np.array([p[:2] for p in points], float)
    if len(P) > 4 or bow <= 0:
        return P
    a, z = P[0], P[-1]
    L = np.linalg.norm(z - a)
    if L < 1:
        return P
    n = np.array([-(z - a)[1], (z - a)[0]]) / L
    side = rnd.choice([-1, 1])
    if len(P) == 2:
        P = np.array([a, (a + z) / 2, z])
    t = np.array([np.dot(p - a, z - a) / L ** 2 for p in P])
    return P + np.outer(np.sin(np.pi * np.clip(t, 0, 1)) * bow * L * side, n)


def stroke(points, width=185, angle=34, bristles=15, seed=0, start=True, end=True, flick=1.0, skip=0.5, bow=0.035):
    """One painted stroke, the way a Japanese brush lays it: the brush lands pressed and angled (a firm, blunt entry
    that swells a little), runs full, and on a free end sweeps out to a sharp point (harai) as it lifts, its outer
    bristles running dry into streaks (kasure) and a few splaying off as fine spikes. A corner end (`end=False`) stops
    without lifting."""
    rng = np.random.default_rng(seed)
    rnd = random.Random(seed)
    W = width
    path = spline(bowed(points, bow, rnd))
    tip_over = 0.6 * W                                 # the sweep carries on past the path's end to its point
    lead = 0.05 * W if start else 0
    post = (tip_over + 1.1 * W * flick) if end else 0
    path, k0 = extend(path, lead, post)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)]) - (np.sum(seg[:k0]) if k0 else 0)
    L = s[-1] - post                                   # where the drawn path itself ends
    m = len(path)
    load = 1 + 0.06 * noise(m, rng, 20)                # the hand presses a little more, a little less
    if start:                                          # lands pressed and angled (a clean edge), swells a little
        entry = (0.9 + 0.1 * np.clip(s / (0.25 * W), 0, 1)) * (1 + 0.1 * np.exp(-((s - 0.3 * W) / (0.22 * W)) ** 2))
    else:
        entry = np.ones(m)
    T = min(1.6 * W, 0.65 * L + 0.5 * W)               # the sweep out (harai): long, unless the stroke is short
    lift = np.clip((L + tip_over - s) / T, 0, 1) ** 0.95 if end else np.ones(m)
    Ws = W * load * entry * lift
    Wspread = W * load * entry * np.maximum(lift, 0.5)  # a splayed bristle doesn't close in with the rest
    phi = math.radians(angle) + math.radians(5) * noise(m, rng, 30)    # the brush turns a little in the hand
    e = np.column_stack([np.cos(phi), np.sin(phi)])   # along the brush's edge
    f = np.column_stack([-np.sin(phi), np.cos(phi)])  # across its thickness

    shapes = []
    for u in np.linspace(-1, 1, bristles) + rng.uniform(-0.04, 0.04, bristles):
        v = rng.uniform(-0.26, 0.26)
        r = W * rng.uniform(0.05, 0.085)
        outer = abs(u) > 0.5
        splay = end and rnd.random() < (0.26 if outer else 0.04)
        width_here = Wspread if splay else Ws
        pos = path + e * ((u + 0.045 * noise(m, rng, 12)) * width_here / 2)[:, None] + f * (v * width_here / 2)[:, None]
        a = rnd.uniform(-lead, lead) if start else 0.0
        if not end:
            b = L + rnd.uniform(-0.02, 0.06) * W
        elif splay:
            b = L + tip_over + rnd.uniform(0.25, 1.0) * W * flick   # a bristle splays off: a fine spike
        else:
            b = L + tip_over * rnd.uniform(0.7, 1.05)
        t_out = rnd.uniform(0.35, 0.7) * W if splay else 0.12 * W
        taper = np.clip((s - a) / (0.08 * W), 0, 1) * np.clip((b - s) / t_out, 0, 1)
        rad = r * np.sqrt(taper) * (np.sqrt(lift) if (end and not splay) else 1)
        # kasure: going fast, a bristle runs out of ink part way and leaves a white streak to the end, or skips a stretch
        if L > 1.6 * W and rnd.random() < skip * (1.35 if outer else 0.4):
            g0 = rnd.uniform(0.6, 0.92) * L
            g1 = s[-1] + 1 if rnd.random() < 0.55 else g0 + rnd.uniform(0.12, 0.3) * L
            rad = rad * (1 - np.clip(np.minimum(s - g0, g1 - s) / (0.1 * W), 0, 1))
        idx = np.where(rad > 0.5)[0]
        for run in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1):   # each run of ink is its own mark
            if len(run) < 2:
                continue
            lo, hi = max(run[0] - 1, 0), min(run[-1] + 2, m)
            t = trace(pos[lo:hi], rad[lo:hi])
            if t is not None and not t.is_empty:
                shapes.append(t)
    return unary_union(shapes)
