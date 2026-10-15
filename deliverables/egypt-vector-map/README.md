# Egypt tourism vector landscape

## Files

- `egypt-tourism.svg`: primary artwork; genuine vector paths, gradients, patterns and reusable symbols. No embedded bitmap, fonts, visible text, markers, scripts or external runtime assets.
- `preview.png`: rendered 1920 × 1120 composition.
- `destinations.json`: 23 destination anchors, geographic coordinates, verification status and corresponding landmark group IDs.
- `coordinates.js`: dependency-free coordinate conversion helpers for a future interaction layer.
- `build_map.py`: deterministic, editable source generator.
- `source/`: downloaded Natural Earth inputs, used only when rebuilding.
- `validation.json`: structural checks and asset counts.

The artwork is an initial stylized vector interpretation. It does **not** reproduce the reference's painterly detail or achieve its miniature-world visual richness. Monument silhouettes, terrain, vegetation and architecture are simplified and enlarged. Review the supplied preview before treating this as final art direction. The existing website has not been modified or integrated with this asset.

## Coordinates and accuracy

The stable SVG `viewBox` is `0 0 1920 1120`; north is up. Geographic bounds are west 24°, east 36.8°, south 21.7°, north 32.8°. Coordinates use a documented affine equirectangular mapping:

```js
x = (longitude - 24) / 12.8 * 1920;
y = (32.8 - latitude) / 11.1 * 1120;
```

The axes have deliberately different scales to create a panorama. This is not a distance-preserving map or a navigation product. Preserve the entire illustration's aspect ratio when embedding; do not independently stretch SVG layers.

Coastlines, primary Nile centerline and lake shapes derive from Natural Earth 1:50m geometry. At this scale shorelines are generalized. The additional Damietta distributary and agricultural envelope are editorial approximations. Decorative reefs, mountain shapes, fields, groves and settlements are illustrative, not mapped individual objects. The full rectangular geographic extent includes neighboring terrain; it does not depict political boundaries.

Five city anchors (Alexandria, Cairo, Luxor, Aswan and Suez) are checked against Natural Earth place-point records. The remaining anchors are **approximate editorial locations**, explicitly flagged in JSON; independently verify them against an authoritative attraction or GIS source before making precise location claims. Verified city centers are not monument entrances. Coordinates are stored separately from `svg` coordinates in each destination's `geographic` object.

Monuments are much larger than geographic scale. Their named groups may extend away from their true anchors to keep them legible. Always use the JSON geographic anchor for location markers; do not infer geography from an illustration's bounding-box center. Closely spaced Luxor/Karnak and Aswan/Philae markers will require clustering or zoom-dependent visibility.

## Layer structure and editing

Top-level named groups: `seas`, `geography`, `western-desert`, `eastern-desert-and-sinai`, `nile-valley-and-delta`, `riverbank-groves-and-villages`, `oases`, `landmark-clusters`, `marine-details`.

Landmarks use `landmark-{destination-id}`. Repeated palms, trees, buildings, boats, columns, pyramids and terrain elements are reusable definitions referenced by `<use>`. Edit a definition to update all instances; edit an individual instance transform for local positioning. All definitions and references are internal. `land-clip` prevents terrain from entering the surrounding seas. Landmark details and hydrographic geometry remain independent.

SVG root title and description supply accessible alternative text without visible labels. When embedding with `<img>`, also supply the site's appropriate `alt` and `title` attributes.

## Future interaction layer

Place the illustration and a sibling marker group inside one shared SVG viewport group. Apply pan/zoom transforms to that common parent so the artwork and marker positions remain aligned. Alternatively, update the root viewBox. Keep controls and popups outside the artwork. An `<img>` embed supports display but does not expose internal groups for hover/click behavior.

`coordinates.js` exports forward/inverse geographic transforms and pointer-to-SVG conversion using `getScreenCTM().inverse()`. Pass the shared transformed viewport element to pointer conversion when using group transforms. This accounts for responsive scaling and letterboxing. Do not multiply coordinates by viewport width without handling offsets and scaling.

Generate markers from your application's actual destination data. Use keyboard-accessible buttons or links, accessible labels, visible focus indicators, and real destination URLs. Do not make a destination clickable until it has a corresponding action or page. The asset itself intentionally contains no interactive UI.

## Sources and reproducibility

Physical datasets: https://www.naturalearthdata.com/downloads/50m-physical-vectors/

Source GeoJSON: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

Inputs: `ne_50m_land`, `ne_50m_rivers_lake_centerlines`, `ne_50m_lakes`, `ne_10m_populated_places`. Retrieved 2026-10-15. Natural Earth data is public domain; source coordinates are generalized cartographic records, not a precision survey.

Run `python build_map.py` from any directory. The generator uses only the Python standard library for SVG and JSON. For PNG output, install `resvg-py`, or install it into `.render-deps` beside the script. The downloaded rendering dependency is not included in the delivery archive and is not needed by the website. Random illustration placement uses a fixed seed.

## Validation and limitations

Parsed the generated SVG as XML; checked unique IDs, all local symbol references, destination bounds and landmark group references. Confirmed no image/script/foreignObject/text elements. Rendered with resvg and visually inspected the complete composition. Corrected Nile boat placement after the first render. A 2× preview was also rendered to exercise vector scaling.

Browser pan/zoom, screen-reader behavior, mobile integration and runtime performance have not been tested. No website performance improvement is claimed. The supplied validation concerns the standalone asset, not site-wide rules or form behavior.
