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

The **Hero art** button (bottom-right) opens an explorer for style, palette, colours, density, speed and grid lines. Every change is written to the URL, so **Copy link** shares the exact look, layout seed included.

URL parameters: `art`, `pal`, `bg`, `ink`, `ac`, `d` (density), `s` (speed), `grid`, `seed`, plus `panel=1` (open the explorer), `at=9000` (start 9s in) and `controls=0` (hide the explorer).

Before launch, fix the chosen values as defaults in `opts` and turn the explorer off with `data-controls="off"` on `.hero-band`.
