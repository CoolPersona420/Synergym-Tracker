# Synergym Brush

The app's title font: punk brush lettering, drawn from scratch with code rather than by hand.

- `brush.py` is the brush: a row of bristles held at an angle. Each bristle has its own width and wander and decides
  for itself when to land and when to let go, so stroke ends splinter into prongs, starts get thin lead-in spikes,
  and a fast stroke can skip, leaving a dry streak.
- `glyphs.py` holds the letters as brush paths: a–z, A–Z, 0–9 and common punctuation, printed rather than joined,
  each stroke in the order and direction a hand would paint it (the end is where it splinters).
- `build.py` paints every glyph twice with a slightly different hand, sets each a touch off true, leans it, and writes
  `public/fonts/synergym-brush.woff2`. A `calt` feature alternates the two paintings as you type.

Rebuild after changing a letter or the brush:

```sh
pip install shapely fonttools brotli numpy
python3 tools/brush-font/build.py
```
