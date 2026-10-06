/** Adds one matching city-map slide to the gallery rail and lightGallery source.
 * Load with defer inside #lightgallery, with data-locations-id pointing to the
 * tour location text. Deferred execution can read locations further down the page.
 * The gallery initializer awaits tourGalleryMapReady before capturing image URLs.
 */
(function () {
  'use strict';

  // Paste your free Geoapify API key here (geoapify.com → dashboard → API keys).
  var GEOAPIFY_API_KEY = '0c4e4567e0a9452a98d85e806e1b3e0a';

  var GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/search';
  var GEOAPIFY_URL = 'https://maps.geoapify.com/v1/staticmap';
  var BRAND_COLOR = '16507d';

  var thisScript = document.currentScript;
  var lightgalleryEl = thisScript && thisScript.parentElement;
  var locationsElId = thisScript && thisScript.getAttribute('data-locations-id');
  var trackEl = document.getElementById('galleryHeroTrack');

  // The big script's init IIFE can await this so it doesn't build
  // dynamicEl before the real map image is ready. Resolves either way —
  // on success, on failure, or immediately if this module bails out.
  var resolveReady;
  window.tourGalleryMapReady = new Promise(function (res) { resolveReady = res; });

  if (!lightgalleryEl || !locationsElId || !trackEl) { resolveReady(); return; }

  var locationsEl = document.getElementById(locationsElId);
  if (!locationsEl) { resolveReady(); return; }

  var names = (locationsEl.textContent || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  if (!names.length) { resolveReady(); return; }

  var placeholderSrc =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
        '<rect width="100%" height="100%" fill="#eef2f1"/>' +
        '<text x="400" y="240" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#16507D">Tour city map unavailable</text>' +
        '<text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#394552">Please try again later</text>' +
      '</svg>'
    );

  var nextIndex = trackEl.querySelectorAll('.gallery-hero__thumb').length;

  // --- Placeholder in the visible wheel ----------------------------------
  var thumbBtn = document.createElement('button');
  thumbBtn.className = 'gallery-hero__thumb';
  thumbBtn.type = 'button';
  thumbBtn.dataset.index = String(nextIndex);
  thumbBtn.dataset.type = 'image';
  thumbBtn.dataset.galleryMap = 'true';
  thumbBtn.dataset.full = placeholderSrc;

  var thumbImg = document.createElement('img');
  thumbImg.src = placeholderSrc;
  thumbImg.alt = 'Route map';
  thumbImg.title = 'Route map';
  thumbImg.loading = 'lazy';
  thumbImg.width = 120;
  thumbImg.height = 120;

  thumbBtn.appendChild(thumbImg);
  trackEl.appendChild(thumbBtn);

  // --- Matching placeholder in the hidden dynamicEl source ---------------
  var lgAnchor = document.createElement('a');
  lgAnchor.href = placeholderSrc;
  lgAnchor.dataset.src = placeholderSrc;
  lgAnchor.dataset.thumb = placeholderSrc;
  lgAnchor.dataset.subHtml = 'Route map';
  lgAnchor.className = 'tour-img';

  lightgalleryEl.insertBefore(lgAnchor, thisScript);

  if (!GEOAPIFY_API_KEY || GEOAPIFY_API_KEY === 'YOUR_GEOAPIFY_API_KEY') {
    console.warn('tour-gallery-map: set GEOAPIFY_API_KEY in tour-gallery-map.js');
    resolveReady();
    return;
  }

  function geocode(name) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 6000);
    var url = GEOCODING_URL + '?format=json&limit=1&filter=countrycode:eg&text=' + encodeURIComponent(name) + '&apiKey=' + encodeURIComponent(GEOAPIFY_API_KEY);
    return fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('City lookup failed (HTTP ' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        var point = data.results && data.results[0];
        if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) throw new Error('City coordinates unavailable');
        return { name: name, lat: point.lat, lon: point.lon };
      }).finally(function () { clearTimeout(timer); });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var timer = setTimeout(function () { finish(new Error('Map image timed out')); }, 8000);
      function finish(error) {
        clearTimeout(timer); image.onload = image.onerror = null;
        if (error) reject(error); else resolve(url);
      }
      image.onload = function () { finish(); };
      image.onerror = function () { finish(new Error('Map image could not load. Check API key restrictions or quota.')); };
      image.src = url;
    });
  }

  function buildStaticMapUrl(points) {
    var markers = points
      .map(function (p, i) {
        return 'lonlat:' + p.lon + ',' + p.lat + ';color:%23' + BRAND_COLOR + ';size:48;type:circle;text:' + (i + 1);
      })
      .join('|');

    var params = ['style=osm-bright', 'width=800', 'height=500', 'marker=' + markers, 'apiKey=' + GEOAPIFY_API_KEY];

    if (points.length > 1) {
      var path = points.map(function (p) { return p.lon + ',' + p.lat; }).join(',');
      params.splice(3, 0, 'geometry=polyline:' + encodeURIComponent(path) + ';linecolor:%23' + BRAND_COLOR + ';linewidth:3');
    }

    return GEOAPIFY_URL + '?' + params.join('&');
  }

  Promise.all(names.map(geocode))
    .then(function (points) {
      var mapUrl = buildStaticMapUrl(points);
      var title = names.map(function (name, i) { return (i + 1) + '. ' + name; }).join(' / ') + ' - city locations (not a road route)';
      return loadImage(mapUrl).then(function () {

      thumbImg.src = mapUrl;
      thumbImg.alt = title;
      thumbImg.title = title;
      thumbBtn.dataset.full = mapUrl;

      lgAnchor.href = mapUrl;
      lgAnchor.dataset.src = mapUrl;
      lgAnchor.dataset.thumb = mapUrl;
      lgAnchor.dataset.subHtml = title.replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
      });
    })
    .catch(function (err) {
      console.warn('tour-gallery-map: ' + err.message);
      // Leave the placeholder in place rather than a broken image.
    })
    .then(function () {
      resolveReady();
      document.dispatchEvent(new Event('tour-gallery-map:updated'));
    });
})();
