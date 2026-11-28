# Synergym Brush

The app's title font, drawn from scratch with code rather than by hand.

- `brush.py` is the brush. It turns a pen path into a painted stroke: a soft, slightly flattened tip that presses
  heavy on downstrokes and lighter going up, lands and lifts with a taper, and wobbles a little in its load. On a
  word's last letter the stroke sweeps on and runs dry into bristle streaks.
- `glyphs.py` holds the letters as pen paths: a–z, A–Z, 0–9 and common punctuation. Lowercase letters join at the
  same height, so a word paints as one line.
- `build.py` paints every glyph, leans it, and writes `public/fonts/synergym-brush.woff2`. A `calt` feature swaps
  in the tailed form of a letter when it ends a word.

Rebuild after changing a letter or the brush:

```sh
pip install shapely fonttools brotli numpy
python3 tools/brush-font/build.py
```
