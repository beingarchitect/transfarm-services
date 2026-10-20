/**
 * Pure terrain maths: no network or Firestore, so it can be exercised on
 * its own. Coordinates are WGS84 degrees, elevations metres.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ElevationSample extends LatLng {
  /** Smoothed elevation in metres above sea level. */
  e: number;
}

/**
 * Indian soil-conservation slope classes (per cent). Advice on the app is
 * keyed off these.
 */
export type SlopeClass = "level" | "gentle" | "moderate" | "strong" | "steep";

export interface TerrainSummary {
  sampleCount: number;
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  /** Overall gradient from a plane fitted through every sample. */
  slopePercent: number;
  slopeClass: SlopeClass;
  /** Compass bearing water flows towards (0 = north, 90 = east). */
  downhillBearing: number;
  /** Fall across the plot along the slope, from the fitted plane (m). */
  fallMetres: number;
  highest: ElevationSample;
  lowest: ElevationSample;
  /** Too few samples (very small plot) - treat the numbers as rough. */
  lowConfidence: boolean;
}

export function pointInPolygon(p: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function slopeClassOf(percent: number): SlopeClass {
  if (percent < 1) return "level";
  if (percent < 3) return "gentle";
  if (percent < 8) return "moderate";
  if (percent < 15) return "strong";
  return "steep";
}

/**
 * Least-squares plane z = a + b·x + c·y over local metric coordinates
 * (x east, y north). Returns null when the samples don't span an area.
 */
function fitPlane(points: { x: number; y: number; z: number }[]): { a: number; b: number; c: number } | null {
  const n = points.length;
  if (n < 3) return null;
  let sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (const { x, y, z } of points) {
    sx += x; sy += y; sz += z;
    sxx += x * x; syy += y * y; sxy += x * y;
    sxz += x * z; syz += y * z;
  }
  // Normal equations, solved by Cramer's rule.
  const m = [
    [n, sx, sy],
    [sx, sxx, sxy],
    [sy, sxy, syy],
  ];
  const r = [sz, sxz, syz];
  const det3 = (q: number[][]) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det3(m);
  if (Math.abs(d) < 1e-9) return null;
  const withColumn = (col: number) => m.map((row, i) => row.map((v, j) => (j === col ? r[i] : v)));
  return {
    a: det3(withColumn(0)) / d,
    b: det3(withColumn(1)) / d,
    c: det3(withColumn(2)) / d,
  };
}

/** Summarises smoothed samples taken inside a plot boundary. */
export function summarise(samples: ElevationSample[]): TerrainSummary | null {
  if (samples.length === 0) return null;

  // Local tangent-plane metres around the first sample; fine at plot scale.
  const lat0 = samples[0].lat;
  const lng0 = samples[0].lng;
  const mPerDegLat = 110540;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const points = samples.map((s) => ({
    x: (s.lng - lng0) * mPerDegLng,
    y: (s.lat - lat0) * mPerDegLat,
    z: s.e,
  }));

  let highest = samples[0];
  let lowest = samples[0];
  let total = 0;
  for (const s of samples) {
    if (s.e > highest.e) highest = s;
    if (s.e < lowest.e) lowest = s;
    total += s.e;
  }

  const plane = fitPlane(points);
  let slopePercent = 0;
  let downhillBearing = 0;
  let fallMetres = highest.e - lowest.e;
  if (plane) {
    const gradient = Math.hypot(plane.b, plane.c);
    slopePercent = gradient * 100;
    // Water flows against the gradient: bearing of (-b, -c) from north.
    downhillBearing = ((Math.atan2(-plane.b, -plane.c) * 180) / Math.PI + 360) % 360;
    const predicted = points.map((p) => plane.a + plane.b * p.x + plane.c * p.y);
    fallMetres = Math.max(...predicted) - Math.min(...predicted);
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    sampleCount: samples.length,
    minElevation: round1(lowest.e),
    maxElevation: round1(highest.e),
    meanElevation: round1(total / samples.length),
    slopePercent: Math.round(slopePercent * 100) / 100,
    slopeClass: slopeClassOf(slopePercent),
    downhillBearing: Math.round(downhillBearing),
    fallMetres: round1(fallMetres),
    highest: { ...highest, e: round1(highest.e) },
    lowest: { ...lowest, e: round1(lowest.e) },
    lowConfidence: samples.length < 6,
  };
}

/**
 * Stable text form of a boundary, used to tell whether a stored result
 * still matches the plot (re-computed only when the boundary changes).
 */
export function boundarySignature(boundary: LatLng[]): string {
  return boundary.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";");
}
