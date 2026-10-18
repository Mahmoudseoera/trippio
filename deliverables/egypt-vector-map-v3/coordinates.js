/** Coordinate helpers for this exact v3 viewBox. Input order: longitude, latitude. */
const xScale = 2400 / 12.8;
const yScale = xScale / Math.cos(27 * Math.PI / 180);

export function geographicToSvg(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new TypeError('Finite coordinates required.');
  return { x: (longitude - 24) * xScale, y: (32.7 - latitude) * yScale };
}

export function svgToGeographic(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Finite coordinates required.');
  return { longitude: 24 + x / xScale, latitude: 32.7 - y / yScale };
}

export function pointerToSvg(svgViewport, clientX, clientY) {
  const transform = svgViewport.getScreenCTM();
  if (!transform) throw new Error('SVG viewport is not mounted.');
  return new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
}
