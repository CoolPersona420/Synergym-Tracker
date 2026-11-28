# Synergym Brush

The app's title font: bold, fast Japanese brush lettering, drawn from scratch with code rather than by hand.

- `brush.py` is the brush: a row of bristles held at an angle, painting the way a Japanese brush does when it moves
  fast. Each stroke lands with a firm, angled press, runs full, and on a free end sweeps out to a sharp point
  (harai) as it lifts; some bristles run dry into white streaks (kasure) and a few splay off the tip as fine spikes.
- `glyphs.py` holds the letters as brush paths: a–z, A–Z, 0–9 and common punctuation, printed rather than joined,
  each stroke in the order and direction a hand would paint it (the end is where it sweeps out to a point).
- `build.py` paints every glyph twice with a slightly different hand, sets each a touch off true, leans it, and writes
  `public/fonts/synergym-brush.woff2`. A `calt` feature alternates the two paintings as you type.

Rebuild after changing a letter or the brush:

```sh
pip install shapely fonttools brotli numpy
python3 tools/brush-font/build.py
```
