import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../../common/firebaseAdmin";
import { boundarySignature, LatLng, summarise, TerrainSummary, ElevationSample } from "./analysis";
import { sampleInsidePolygon } from "./dem";

export const TERRAIN_COLLECTION = "plot_terrain";

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

/** Same check the security rules use: owner, or any role in memberRoles. */
async function assertFarmMember(farmId: string, uid: string): Promise<void> {
  const farm = await db.collection("farms").doc(farmId).get();
  const data = farm.data();
  const isMember =
    data !== undefined &&
    (data.ownerId === uid || (data.memberRoles && typeof data.memberRoles[uid] === "string"));
  if (!isMember) {
    throw new HttpsError("permission-denied", "Not a member of this farm");
  }
}

/**
 * Terrain for a plot, computed from Copernicus GLO-30 on first request and
 * stored in `plot_terrain/{plotId}`. Re-computed only when the boundary
 * (or the algorithm) changes, so repeat views cost one Firestore read.
 */
export async function getPlotTerrain(plotId: string, uid: string): Promise<PlotTerrain> {
  const plotDoc = await db.collection("field_plots").doc(plotId).get();
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
  const ref = db.collection(TERRAIN_COLLECTION).doc(plotId);
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
