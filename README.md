# Cambridge Digital Minds

Static site for GitHub Pages. No build step: `index.html`, `assets/css/style.css`, `assets/js/main.js`, images in `assets/img/`.

- **Design:** adapted from the CASP About page (casp.ac/about): Spectral + Inter, crimson accent, split label/body sections, bordered card grids, dark footer.
- **Content:** from digitalminds.cam.

## Preview locally

Open `index.html` in a browser, or run `python -m http.server` and go to http://localhost:8000.

## Publish

GitHub → Settings → Pages → Source: *Deploy from a branch*, Branch: `main` / `(root)`.

## Hero art

`assets/js/hero-art.js` draws the animated hero background on a canvas. It reuses the EPDM hero-art timings: a 3.2s staggered entrance, 320–800ms fades, events spaced 0.1–9s apart, a ~5–7s breathing cycle and a ~4% accent colour. There are four styles: **Threads**, **Signal**, **Constellation** and **Dot wave**.

The **Design** button (bottom-right) opens an explorer with these controls:

- **Style**: the four hero art styles.
- **Brand colour**: sets the site-wide primary colour, plus a recommended accent:

  | Primary | Name | Accent |
  |---|---|---|
  | `#1A635F` (default) | Teal | Terracotta `#E07A5F` |
  | `#043230` | Deep teal | Brass `#E3B341` |
  | `#4225FF` | Ultramarine | Tangerine `#FF8A4C` |
  | `#861618` | Oxblood | Champagne `#E4BE7C` |
  | `#5C5D27` | Olive | Clay `#C9663B` |

- **Hero tone**: Light, Tint or Dark. The hero background is derived from the brand colour.
- **Type**: headings in Spectral, Brawler, Tinos or Strichpunkt Sans; body in Inter, Strichpunkt Sans, Tinos or Brawler. Fonts load only when picked.
- **Fine-tuning**: hero colour pickers, density, speed and grid lines.

Every change is written to the URL, so **Copy link** shares the exact look, layout seed included.

URL parameters: `art`, `brand`, `tone`, `bg`, `ink`, `ac`, `hf`, `bf`, `d` (density), `s` (speed), `grid`, `seed`, plus `panel=1` (open the explorer), `at=9000` (start 9s in) and `controls=0` (hide the explorer).

Before launch, fix the chosen values as defaults (`opts` in `hero-art.js`, `--primary`/`--accent` and the font link in the CSS/HTML) and turn the explorer off with `data-controls="off"` on `.hero-band`.

## Hero renders (2048×2048)

```
node tools/render-hero-shots.mjs                 # all sets → renders/
node tools/render-hero-shots.mjs --only=colours  # or fonts | styles
```

This writes one image per brand colour, per heading font and per hero style into `renders/<set>/`. Each image changes only its own variable; everything else stays on the defaults (Threads, teal, light, Spectral/Inter, seed 42). Every shot is a 1536px desktop viewport at 1.333× (`--size=4096` for 4K), captured 12s into the animation with the explorer hidden. Needs Node 18+ and Chrome or Edge (`BROWSER=/path/to/chrome` to override). To add a variation, add a line to `SETS` in the script. `renders/` is git-ignored.
