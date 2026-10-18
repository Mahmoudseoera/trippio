/* True vector viewport: every interaction updates the SVG viewBox. No canvas or raster layer. */
(() => {
  'use strict';

  const stage = document.getElementById('map-stage');
  const object = document.getElementById('map-object');
  const loading = document.getElementById('loading');
  const fallback = document.getElementById('fallback');
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const reset = document.getElementById('reset-view');
  const zoomLevel = document.getElementById('zoom-level');
  const announcement = document.getElementById('announcement');
  const pointers = new Map();
  const maxZoom = 16;
  let svg;
  let original;
  let viewport;
  let gesture;
  let announceTimer;
  let loadTimer;
  let artworkBounds = [];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const currentZoom = () => original.width / viewport.width;

  function update(next, announce = true) {
    const width = clamp(next.width, original.width / maxZoom, original.width);
    const height = width * original.height / original.width;
    viewport = {
      x: clamp(next.x, original.x, original.x + original.width - width),
      y: clamp(next.y, original.y, original.y + original.height - height),
      width,
      height
    };
    svg.setAttribute('viewBox', `${viewport.x} ${viewport.y} ${width} ${height}`);
    // Skip detailed artwork outside the visible vector viewport. Bounds are
    // authored in root coordinates, including each illustration's full extent.
    const margin = 20;
    artworkBounds.forEach(artwork => {
      const visible = artwork.x + artwork.width >= viewport.x - margin &&
        artwork.x <= viewport.x + width + margin &&
        artwork.y + artwork.height >= viewport.y - margin &&
        artwork.y <= viewport.y + height + margin;
      if (artwork.visible !== visible) {
        artwork.element.style.display = visible ? artwork.display : 'none';
        artwork.visible = visible;
      }
    });
    const scale = currentZoom();
    zoomLevel.value = `${Math.round(scale * 100)}%`;
    zoomIn.disabled = scale >= maxZoom - 0.0001;
    zoomOut.disabled = scale <= 1.0001;
    reset.disabled = scale <= 1.0001;
    if (announce) {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { announcement.textContent = `التكبير ${Math.round(scale * 100)} بالمئة`; }, 180);
    }
  }

  function svgPoint(clientX, clientY, matrix = svg.getScreenCTM()) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function zoom(factor, anchor) {
    if (!svg) return;
    const pivot = anchor || { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
    const nextZoom = clamp(currentZoom() * factor, 1, maxZoom);
    const width = original.width / nextZoom;
    const ratio = width / viewport.width;
    update({
      x: pivot.x - (pivot.x - viewport.x) * ratio,
      y: pivot.y - (pivot.y - viewport.y) * ratio,
      width
    });
  }

  function startGesture() {
    const values = [...pointers.values()];
    if (!values.length) { gesture = null; return; }
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    if (values.length === 1) {
      gesture = { type: 'pan', start: values[0], viewport: { ...viewport }, matrix };
    } else {
      const [a, b] = values;
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = {
        type: 'pinch',
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        anchor: svgPoint(center.x, center.y, matrix),
        viewport: { ...viewport },
        zoom: currentZoom(),
        matrix
      };
    }
  }

  function showFallback(message) {
    if (svg) return;
    clearTimeout(loadTimer);
    loading.hidden = true;
    fallback.hidden = false;
    if (message) document.getElementById('fallback-message').textContent = message;
  }

  function initialize(source) {
    if (!source || source.localName !== 'svg') throw new Error('Missing SVG root');
    const root = source.ownerDocument === document ? source : document.importNode(source, true);
    const values = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some(value => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
      throw new Error('The SVG needs a valid viewBox');
    }
    // Local file selection is for the artwork only; do not run embedded SVG scripts.
    root.querySelectorAll('script, foreignObject').forEach(element => element.remove());
    root.querySelectorAll('*').forEach(element => {
      [...element.attributes].forEach(attribute => {
        if (/^on/i.test(attribute.name) || (/^(?:href|xlink:href)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) {
          element.removeAttribute(attribute.name);
        }
      });
    });
    svg = root;
    artworkBounds = [...root.querySelectorAll('[data-art-bounds]')]
      .filter(element => !element.closest('defs'))
      .map(element => {
        const bounds = element.getAttribute('data-art-bounds').split(',').map(Number);
        return {
          element, x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3],
          display: element.style.display, visible: true
        };
      })
      .filter(artwork => [artwork.x, artwork.y, artwork.width, artwork.height].every(Number.isFinite));
    original = { x: values[0], y: values[1], width: values[2], height: values[3] };
    viewport = { ...original };
    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'خريطة مصر المصوّرة، رسم متجهي · Illustrated vector map of Egypt');
    root.setAttribute('focusable', 'false');
    if (root.parentNode !== stage) stage.prepend(root);
    if (object) object.remove();
    stage.classList.add('ready');
    loading.hidden = true;
    fallback.hidden = true;
    clearTimeout(loadTimer);
    pointers.clear();
    gesture = null;
    update(original, false);
    announcement.textContent = 'الخريطة جاهزة. استخدم أزرار التكبير أو لوحة المفاتيح.';
  }

  zoomIn.addEventListener('click', () => zoom(1.5));
  zoomOut.addEventListener('click', () => zoom(1 / 1.5));
  reset.addEventListener('click', () => { if (svg) update(original); });

  stage.addEventListener('wheel', event => {
    if (!svg) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    const delta = clamp(event.deltaY * unit, -240, 240);
    zoom(Math.exp(-delta * 0.0025), svgPoint(event.clientX, event.clientY));
  }, { passive: false });

  stage.addEventListener('pointerdown', event => {
    if (!svg || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    stage.focus({ preventScroll: true });
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.classList.add('dragging');
    startGesture();
  });

  stage.addEventListener('pointermove', event => {
    if (!svg || !pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...pointers.values()];
    if (gesture.type === 'pan' && values.length === 1) {
      const start = svgPoint(gesture.start.x, gesture.start.y, gesture.matrix);
      const point = svgPoint(values[0].x, values[0].y, gesture.matrix);
      update({
        x: gesture.viewport.x + start.x - point.x,
        y: gesture.viewport.y + start.y - point.y,
        width: gesture.viewport.width
      }, false);
    } else if (values.length >= 2) {
      const [a, b] = values;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const nextZoom = clamp(gesture.zoom * distance / gesture.distance, 1, maxZoom);
      const width = original.width / nextZoom;
      const center = svgPoint((a.x + b.x) / 2, (a.y + b.y) / 2, gesture.matrix);
      const ratio = width / gesture.viewport.width;
      update({
        x: gesture.anchor.x - (center.x - gesture.viewport.x) * ratio,
        y: gesture.anchor.y - (center.y - gesture.viewport.y) * ratio,
        width
      });
    }
  });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!pointers.size) stage.classList.remove('dragging');
    startGesture();
  }
  stage.addEventListener('pointerup', finishPointer);
  stage.addEventListener('pointercancel', finishPointer);
  stage.addEventListener('lostpointercapture', finishPointer);

  stage.addEventListener('keydown', event => {
    if (!svg || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 0.3 : 0.12;
    const actions = {
      '+': () => zoom(1.5),
      '=': () => zoom(1.5),
      '-': () => zoom(1 / 1.5),
      '_': () => zoom(1 / 1.5),
      Home: () => update(original),
      '0': () => update(original),
      ArrowLeft: () => update({ ...viewport, x: viewport.x - viewport.width * step }, false),
      ArrowRight: () => update({ ...viewport, x: viewport.x + viewport.width * step }, false),
      ArrowUp: () => update({ ...viewport, y: viewport.y - viewport.height * step }, false),
      ArrowDown: () => update({ ...viewport, y: viewport.y + viewport.height * step }, false)
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });

  document.getElementById('svg-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const markup = await file.text();
      const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
      if (parsed.querySelector('parsererror')) throw new Error('Malformed SVG');
      initialize(parsed.documentElement);
      stage.focus();
    } catch (_) {
      showFallback('تعذّر قراءة الرسم. اختر ملف SVG صالحًا من ملفات الخريطة.');
    }
  });

  // The release package embeds the artwork here to work directly from file://.
  const inlineArtwork = stage.querySelector(':scope > svg');
  if (inlineArtwork) {
    try { initialize(inlineArtwork); } catch (_) { showFallback(); }
  } else if (object) {
    const readObject = () => {
      try {
        const root = object.contentDocument && object.contentDocument.documentElement;
        if (root && root.localName === 'svg') initialize(root);
        else showFallback();
      } catch (_) { showFallback(); }
    };
    object.addEventListener('load', readObject, { once: true });
    object.addEventListener('error', () => showFallback(), { once: true });
    loadTimer = setTimeout(() => showFallback(), 15000);
    try {
      if (object.contentDocument && object.contentDocument.documentElement.localName === 'svg') readObject();
    } catch (_) { /* Wait for the object's load event before showing a local-file fallback. */ }
  } else {
    showFallback();
  }
})();
