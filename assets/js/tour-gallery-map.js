/**
 * Tour Gallery Map
 * ------------------
 * Adds a static route-map image as a normal item in your LightGallery
 * gallery grid (#lightgallery), generated from a Geoapify Static Maps
 * URL — numbered pins for each city, a line connecting them when there's
 * more than one.
 *
 * Setup:
 *   1. Sign up free at https://www.geoapify.com (no card required) and
 *      grab an API key from the dashboard.
 *   2. Paste it into GEOAPIFY_API_KEY below.
 *   3. Place this <script> tag directly inside your gallery container,
 *      right after the last existing <a class="tour-img"> item and
 *      before the closing </div> of #lightgallery — NOT deferred, and
 *      NOT wrapped in DOMContentLoaded. It needs to run exactly where
 *      it sits in the markup so the placeholder item is counted
 *      correctly by your existing "max visible" / "+N" gallery logic.
 *
 *   <div class="tour-gallery" id="lightgallery" data-count="5">
 *     ... your existing <a class="tour-img"> items ...
 *
 *     <!-- Reads the same #tourLocations element as the interactive map -->
 *     <script src="assets/js/tour-gallery-map.js"
 *             data-locations-id="tourLocations"></script>
 *   </div>
 *
 *   The <p id="tourLocations" hidden>Cairo, Giza</p> element (already
 *   used by tour-route-map.js) is reused here too, so you only maintain
 *   one list of stops per tour page.
 */
(function () {
  'use strict';

  // Paste your free Geoapify API key here (geoapify.com → dashboard → API keys).
  var GEOAPIFY_API_KEY = 'YOUR_GEOAPIFY_API_KEY';

  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var GEOAPIFY_URL = 'https://api.geoapify.com/v1/staticmap';
  var BRAND_COLOR = '176F78';

  var thisScript = document.currentScript;
  var galleryEl = thisScript && thisScript.parentElement;
  var locationsElId = thisScript && thisScript.getAttribute('data-locations-id');

  if (!galleryEl || !locationsElId) return;

  var locationsEl = document.getElementById(locationsElId);
  if (!locationsEl) return;

  var names = (locationsEl.textContent || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  if (!names.length) return;

  // --- Insert a placeholder item synchronously, right here in the markup,
  // so it's already present when your gallery-init script runs. --------
  var placeholderSrc =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
        '<rect width="100%" height="100%" fill="#eef2f1"/>' +
      '</svg>'
    );

  var link = document.createElement('a');
  link.href = placeholderSrc;
  link.className = 'tour-img';

  var img = document.createElement('img');
  img.src = placeholderSrc;
  img.alt = 'Route map';
  img.title = 'Route map';

  link.appendChild(img);
  galleryEl.insertBefore(link, thisScript);

  if (!GEOAPIFY_API_KEY || GEOAPIFY_API_KEY === 'YOUR_GEOAPIFY_API_KEY') {
    console.warn('tour-gallery-map: set GEOAPIFY_API_KEY in tour-gallery-map.js');
    return;
  }

  // --- Geocode the stops, build the static map URL, swap it in. --------
  function geocode(name) {
    var url = NOMINATIM_URL + '?format=json&limit=1&q=' + encodeURIComponent(name);
    return fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function (res) {
        if (!res.ok) throw new Error('Could not look up "' + name + '"');
        return res.json();
      })
      .then(function (data) {
        if (!data.length) throw new Error('No match found for "' + name + '"');
        return { name: name.trim(), lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      });
  }

  function buildStaticMapUrl(points) {
    var markers = points
      .map(function (p, i) {
        return 'lonlat:' + p.lon + ',' + p.lat + ';color:%23' + BRAND_COLOR + ';size:large;type:awesome;icon:' + (i + 1);
      })
      .join('|');

    var params = ['style=osm-bright', 'width=800', 'height=500', 'marker=' + markers, 'apiKey=' + GEOAPIFY_API_KEY];

    if (points.length > 1) {
      var path = points.map(function (p) { return p.lat + ',' + p.lon; }).join(',');
      params.splice(3, 0, 'geometry=polyline:' + encodeURIComponent(path) + ';linecolor:%23' + BRAND_COLOR + ';linewidth:3');
    }

    return GEOAPIFY_URL + '?' + params.join('&');
  }

  Promise.all(names.map(geocode))
    .then(function (points) {
      var mapUrl = buildStaticMapUrl(points);
      var title = names.join(' & ') + ' route map';
      link.href = mapUrl;
      img.src = mapUrl;
      img.alt = title;
      img.title = title;
    })
    .catch(function (err) {
      console.warn('tour-gallery-map: ' + err.message);
      // Leave the placeholder item in place rather than showing a broken image.
    });
})();
