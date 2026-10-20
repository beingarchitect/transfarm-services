import { fromUrl, GeoTIFFImage } from "geotiff";
import { ElevationSample, LatLng, pointInPolygon } from "./analysis";

/**
 * Copernicus GLO-30 Digital Surface Model (ESA, open licence), served as
 * Cloud-Optimised GeoTIFFs on the AWS Open Data registry. One 1°×1° tile
 * per file, ~30 m pixels; geotiff.js reads only the byte ranges it needs.
 *
 * Note it is a *surface* model: tree canopy and buildings are included, so
 * readings are smoothed before use.
 */
const TILE_BASE = "https://copernicus-dem-30m.s3.amazonaws.com";

/** Ocean / missing pixels use a large negative nodata value. */
const MIN_VALID_ELEVATION = -500;

/** Cap on samples returned to the app for drawing. */
export const MAX_SAMPLES = 400;

function tileName(latFloor: number, lngFloor: number): string {
  const ns = latFloor >= 0 ? "N" : "S";
  const ew = lngFloor >= 0 ? "E" : "W";
  const lat = String(Math.abs(latFloor)).padStart(2, "0");
  const lng = String(Math.abs(lngFloor)).padStart(3, "0");
  return `Copernicus_DSM_COG_10_${ns}${lat}_00_${ew}${lng}_00_DEM`;
}

// Kept across invocations on a warm instance: the header fetch is the slow
// part, and nearby farms share tiles.
const imageCache = new Map<string, Promise<GeoTIFFImage>>();

function tileImage(latFloor: number, lngFloor: number): Promise<GeoTIFFImage> {
  const name = tileName(latFloor, lngFloor);
  let image = imageCache.get(name);
  if (!image) {
    image = fromUrl(`${TILE_BASE}/${name}/${name}.tif`).then((t) => t.getImage());
    // Don't cache failures (e.g. a transient network error).
    image.catch(() => imageCache.delete(name));
    imageCache.set(name, image);
  }
  return image;
}

/**
 * Elevation samples at every DEM pixel whose centre lies inside the
 * polygon, each smoothed with its 3×3 neighbourhood to damp single-pixel
 * spikes from trees or sheds. Very small plots with no pixel centre inside
 * fall back to the nearest pixel at each corner and the middle.
 */
export async function sampleInsidePolygon(polygon: LatLng[]): Promise<ElevationSample[]> {
  const lats = polygon.map((p) => p.lat);
  const lngs = polygon.map((p) => p.lng);
  const box = {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lngs),
    east: Math.max(...lngs),
  };

  const samples: ElevationSample[] = [];
  const fallback: ElevationSample[] = [];
  const centre = {
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
  };

  // A plot can straddle a whole-degree line; read each tile it touches.
  for (let latFloor = Math.floor(box.south); latFloor <= Math.floor(box.north); latFloor++) {
    for (let lngFloor = Math.floor(box.west); lngFloor <= Math.floor(box.east); lngFloor++) {
      const image = await tileImage(latFloor, lngFloor);
      const [originX, originY] = image.getOrigin();
      const [resX, resY] = image.getResolution(); // resY is negative
      const width = image.getWidth();
      const height = image.getHeight();

      const col = (lng: number) => Math.floor((lng - originX) / resX);
      const row = (lat: number) => Math.floor((lat - originY) / resY);
      // One pixel of margin for smoothing, clamped to this tile.
      const x0 = Math.max(0, col(box.west) - 1);
      const x1 = Math.min(width, col(box.east) + 2);
      const y0 = Math.max(0, row(box.north) - 1);
      const y1 = Math.min(height, row(box.south) + 2);
      if (x0 >= x1 || y0 >= y1) continue;

      const raster = (await image.readRasters({ window: [x0, y0, x1, y1] }))[0] as ArrayLike<number>;
      const w = x1 - x0;
      const h = y1 - y0;
      const at = (x: number, y: number) => raster[y * w + x];

      const smoothed = (x: number, y: number): number | null => {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const v = at(nx, ny);
            if (v > MIN_VALID_ELEVATION) {
              sum += v;
              count++;
            }
          }
        }
        return count === 0 ? null : sum / count;
      };

      const pixelCentre = (x: number, y: number): LatLng => ({
        lat: originY + (y0 + y + 0.5) * resY,
        lng: originX + (x0 + x + 0.5) * resX,
      });

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = pixelCentre(x, y);
          if (!pointInPolygon(p, polygon)) continue;
          const e = smoothed(x, y);
          if (e !== null) samples.push({ ...p, e });
        }
      }

      // Fallback points for tiny plots, if they fall in this tile.
      for (const p of [...polygon, centre]) {
        const x = col(p.lng) - x0;
        const y = row(p.lat) - y0;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const e = smoothed(x, y);
        if (e !== null) fallback.push({ ...p, e });
      }
    }
  }

  const result = samples.length > 0 ? samples : fallback;
  if (result.length <= MAX_SAMPLES) return result;
  // Large holdings: keep an even spread so the app can still draw it.
  const step = result.length / MAX_SAMPLES;
  return Array.from({ length: MAX_SAMPLES }, (_, i) => result[Math.floor(i * step)]);
}
