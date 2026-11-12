import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../../common/firebaseAdmin";
import { roleOf } from "../members/service";
import { boundarySignature, LatLng, summarise, TerrainSummary, ElevationSample } from "./analysis";
import { sampleInsidePolygon } from "./dem";

export const PLOTS_COLLECTION = "farm_plots";

/** One cache document per plot: farm_plots/{plotId}/terrain/current. */
export function terrainRef(plotId: string) {
  return db.collection(PLOTS_COLLECTION).doc(plotId).collection("terrain").doc("current");
}

/** Bump to force recomputation after an algorithm change. */
const ALGORITHM_VERSION = 1;

export interface PlotTerrain {
  plotId: string;
  farmId: string;
  source: "copernicus-glo30";
  algorithmVersion: number;
  boundarySignature: string;
  computedAt: string;
  summary: TerrainSummary;
  samples: ElevationSample[];
}

/** Same check the security rules use: a member document, any role. */
async function assertFarmMember(farmId: string, uid: string): Promise<void> {
  if ((await roleOf(farmId, uid)) === undefined) {
    throw new HttpsError("permission-denied", "Not a member of this farm");
  }
}

/**
 * Terrain for a plot, computed from Copernicus GLO-30 on first request and
 * stored in `farm_plots/{plotId}/terrain/current`. Re-computed only when the boundary
 * (or the algorithm) changes, so repeat views cost one Firestore read.
 */
export async function getPlotTerrain(plotId: string, uid: string): Promise<PlotTerrain> {
  const plotDoc = await db.collection(PLOTS_COLLECTION).doc(plotId).get();
  const plot = plotDoc.data();
  if (!plot) throw new HttpsError("not-found", "Plot not found");

  const farmId = plot.farmId as string;
  await assertFarmMember(farmId, uid);

  const boundary: LatLng[] = ((plot.boundary as { lat: number; lng: number }[]) ?? []).map((c) => ({
    lat: c.lat,
    lng: c.lng,
  }));
  if (boundary.length < 3) {
    throw new HttpsError("failed-precondition", "Plot has no boundary");
  }

  const signature = boundarySignature(boundary);
  const ref = terrainRef(plotId);
  const cached = (await ref.get()).data() as PlotTerrain | undefined;
  if (
    cached &&
    cached.boundarySignature === signature &&
    cached.algorithmVersion === ALGORITHM_VERSION
  ) {
    return cached;
  }

  const samples = await sampleInsidePolygon(boundary);
  const summary = summarise(samples);
  if (!summary) {
    throw new HttpsError("unavailable", "No elevation data for this location");
  }

  const terrain: PlotTerrain = {
    plotId,
    farmId,
    source: "copernicus-glo30",
    algorithmVersion: ALGORITHM_VERSION,
    boundarySignature: signature,
    computedAt: new Date().toISOString(),
    summary,
    samples: samples.map((s) => ({
      lat: Math.round(s.lat * 1e6) / 1e6,
      lng: Math.round(s.lng * 1e6) / 1e6,
      e: Math.round(s.e * 10) / 10,
    })),
  };
  await ref.set(terrain);
  return terrain;
}
