# Egypt illustrated vector map — revision 3

## Open the result

Open **viewer.html** for a local pan-and-zoom preview. It includes the vector artwork inline and loads only the adjacent `viewer.js`; no server, account, fonts or third-party runtime library is needed. The controls change the SVG's viewBox rather than enlarging a screenshot.

- **egypt-tourism-vector.svg** — the primary editable map.
- **egypt-tourism-vector.svgz** — the same SVG compressed with gzip. Configure the correct SVG MIME type and gzip content encoding if serving this variant.
- **destinations.json** — 25 destination anchors, geographic coordinates, source/verification status, illustration group IDs and artwork displacement/bounds.
- **preview.png** — complete composition rendered from the final SVG; for quick review only.
- **detail-giza-5x.png** — Giza detail rendered from the SVG at 5×; for quick review only.
- **symbols/landmarks/** and **symbols/terrain/** — 18 separately editable vector illustration assets and reusable libraries.
- **validation.json** and **qa/** — validation evidence, asset contact sheet, geographic diagnostic and browser QA where available.

The SVG, not either PNG preview, is the deliverable for scalable web integration. Existing Trippio pages and the previous revisions have not been changed.

## What is vector

The final SVG contains real paths, gradients, patterns, clipping paths, vector masks and reusable symbols. It contains **zero image elements, external raster references, base64 images, canvas surfaces or filter effects**. The generated architectural and terrain art was converted into colored Bézier paths before being composed onto the map. Source PNG atlases are preserved in `source/art/` for reproducibility, but the map does not load or embed them.

This is traced vector illustration, not a claim that every stone was manually drawn as a semantic object. Regions, landmarks and reusable components are named and independently editable; individual color patches remain ordinary editable paths. At large zoom the curves are rerendered smoothly without pixelation, but the finite detail of the source drawing does not increase. Tracing simplifies small textures and statues into color shapes. It is not a lossless reproduction of the earlier painterly PNG.

## Geography and scale

North is up. Coastlines, the Egypt country outline, Nile branches and meanders, canals and Lake Nasser come from the **Natural Earth 1:10,000,000** dataset. The `10m` dataset name means ten-million map scale, **not ten-meter positional accuracy**. The mapped extent also includes neighboring terrain for context.

The physical aspect ratio is preserved at a standard parallel of 27°N, rather than squeezing Egypt vertically into a wide panorama. The viewBox is `0 0 2400 2378`. Bounds are 24°E–36.8°E and 21.4°N–32.7°N. The sub-pixel height rounding is only a canvas edge choice.

```js
const width = 2400;
const xScale = width / 12.8;
const yScale = xScale / Math.cos(27 * Math.PI / 180);
const x = (longitude - 24) * xScale;
const y = (32.7 - latitude) * yScale;

// Inverse conversion:
const longitude = 24 + x / xScale;
const latitude = 32.7 - y / yScale;
```

This is a locally proportionate equirectangular projection, not a survey or a navigation map. Coastlines are generalized. Landmark footprints, relief, oasis scenery, houses, cultivated fields, boats and palms are illustrative and enlarged. Mountain placements show broad geographic regions, not a measured elevation surface. Natural Earth's supplied country boundary is retained; it is not an official legal boundary determination.

Lake Nasser, both Delta branches and both gulfs are preserved from source geometry. The Nile is drawn slightly wider than geographic scale for visibility. Smaller lakes omitted by the source have not been invented as hydrographic polygons; the water inside oasis illustrations is symbolic.

## Anchors and enlarged illustrations

Each `destinations.json` item keeps longitude/latitude and its projected `svg` anchor separate from the artwork's visible bounds. Ten generalized city anchors were checked against Natural Earth place records. Other attraction/oasis anchors are explicitly marked approximate or unverified. Independently verify precise entrances or live attraction pins before claiming survey-level accuracy.

The original 23 destinations are retained, with Hatshepsut and Qaitbay added. Neighboring monuments around Luxor and Aswan are separated visually for legibility; their true reference anchors remain fixed. Recorded offsets belong to illustrations, not geography. Do not use the center of an illustration's bounds as a location coordinate. Do not reuse v1 or v2 screen coordinates for this revision.

## Editing and interaction

Top-level layers are named: `seas`, `geographic-land`, `desert-surface`, `western-desert-relief`, `eastern-desert-relief`, `nile-agriculture`, `hydrography`, `riverbank-vegetation`, `oases-and-settlements`, `egypt-monuments`, `nile-life`, `country-outline`.

Destinations use `destination-{id}` groups. Architectural and terrain symbols use `art-{id}`; repeated small vegetation and houses have separate definitions. Edit a symbol to update its instances; edit a destination transform/placement to update that vignette. For reproducible edits, adjust `build_map.py` and rebuild rather than editing both the exported SVG and viewer separately.

Add dynamic markers in a separate SVG group sharing the artwork's viewBox. Marker locations should use the `svg` anchor values from JSON or the formula above. For HTML popups, convert with `getScreenCTM()`; for pointer-to-map conversion, use its inverse. This accounts for the viewport's aspect-ratio letterboxing. Include keyboard-accessible names and actual destination actions for clickable markers. Artwork itself contains no UI, visible labels or map pins.

The viewer zooms from 1× to 16×, supports pan, wheel, touch and keyboard input, and keeps its controls outside the illustration. This is a preview tool, not integration into the existing travel site. Preserve the SVG's aspect ratio when embedding. If embedding as `<img>`, provide appropriate alt and title text; inline SVG supports internal interaction.

Complex illustration instances carry `data-art-bounds`; the viewer temporarily hides those outside the visible geographic viewport, then restores them when panning back. This reduces unnecessary rendering without removing vector detail from the downloadable SVG.

## Verification

The exported SVG passed XML parsing, unique-ID and internal-reference checks, absence-of-raster checks, all 25 anchor bounds and coordinate round trips. The complete composition and a 5× Giza detail were rendered with resvg and visually inspected.

The assembled viewer passed 19 checks in installed Chrome 155 using a direct local file URL, at desktop 1440 × 1000 and mobile 390 × 844 viewport sizes. Checks covered actual viewBox zoom, pointer anchoring, drag, reset, keyboard controls, 1600% cap, offscreen culling/restoration, pinch, and no horizontal overflow. No console, script or request errors were recorded. These are desktop Chrome and mobile-emulation results, not a physical-phone or all-browser performance guarantee. Evidence is in `qa/browser-report.json` and the accompanying screenshots.

## Performance and runtime files

The full SVG is approximately 9.3 MB uncompressed and 3.1 MB gzip. That is substantially heavier than a small icon map; enable compression and caching for web use. Reusable symbols avoid duplicating their path definitions. Browser zoom speed depends on device and engine, especially on mobile. A guarantee of unlimited zoom with zero performance cost would be inaccurate.

For the standalone viewer deploy: `viewer.html`, `viewer.js`, `egypt-tourism-vector.svg` and `destinations.json`. The SVG appears both inline in the viewer and as a separate download file. For an actual website component, deploy the SVG/JSON once and integrate its interaction layer into your application. Preview PNGs, generators, QA, source atlases, downloaded datasets and installed Python dependencies are not runtime assets.

## Rebuild

`python build_map.py` composes SVG/JSON, updates the viewer from `viewer.template.html` and performs structural checks. It needs only Python's standard library and the compact geography/symbol files.

`python build_map.py --render` also creates the PNG previews using `resvg-py`. The script first checks the earlier workspace renderer directory; an ordinarily installed `resvg-py` also works. Source imagery does not take part in this step.

The optional `tools/trace_assets.py` recreates the vector symbols from the source atlases with Pillow and VTracer; dependencies are listed in `tools/requirements.txt`. `source/prepare_geography.py` recreates the compact geographic data from the original downloaded Natural Earth GeoJSON datasets. Those large upstream files are omitted from the source archive; filenames, URLs and checksums are stored in `source/geography.json`.

The editable-source archive complements the runtime archive: extract both into the same location to rebuild. It includes local anchor inputs, so it does not require the previous revisions. `package_delivery.py` recreates the two ZIPs and checks their integrity. Source PNG atlases are development inputs only.

## Provenance

Geography was downloaded on 2026-10-15. Revision 3 composition and validation were completed on 2026-10-18.

- Natural Earth physical vectors: https://www.naturalearthdata.com/downloads/10m-physical-vectors/
- Upstream GeoJSON: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
- Public-domain terms: https://www.naturalearthdata.com/about/terms-of-use/

The generated art is a tourism illustration; it is not a surveyed architectural reconstruction. The user's supplied reference maps guided geographic expectations, while the PNG panorama guided warm gold/turquoise color and dimensional illustration style.
