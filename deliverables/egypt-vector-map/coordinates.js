/** Stable coordinates for egypt-tourism.svg. No DOM mutations or markers. */
export function geographicToSvg(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new TypeError('Longitude and latitude must be finite numbers.');
  }
  return { x: (longitude - 24) / 12.8 * 1920, y: (32.8 - latitude) / 11.1 * 1120 };
}

export function svgToGeographic(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError('SVG coordinates must be finite numbers.');
  }
  return { longitude: 24 + x / 1920 * 12.8, latitude: 32.8 - y / 1120 * 11.1 };
}

/** Pass the shared artwork/markers group if it carries the pan/zoom transform. */
export function pointerToSvg(viewportElement, clientX, clientY) {
  const matrix = viewportElement.getScreenCTM();
  if (!matrix) throw new Error('The SVG viewport must be mounted and visible.');
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
