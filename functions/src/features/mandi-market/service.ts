import { logger } from "firebase-functions";
import { fetchDataGovResource } from "./dataGovClient";
import { FALLBACK_RESOURCE_ID, PRIMARY_RESOURCE_ID } from "./constants";
import { normalizeFallbackRecord, normalizePrimaryRecord } from "./normalize";
import { FallbackRawRecord, MandiPriceQuery, MandiPriceResponse, PrimaryRawRecord } from "./types";

/**
 * Fetches mandi market prices from data.gov.in, trying the primary
 * (variety-wise) dataset first and falling back to the older, more stable
 * dataset if the primary one errors out (e.g. the reported intermittent 502s).
 */
export async function getMandiPrices(query: MandiPriceQuery, apiKey: string): Promise<MandiPriceResponse> {
  try {
    const records = await fetchDataGovResource<PrimaryRawRecord>({
      resourceId: PRIMARY_RESOURCE_ID,
      apiKey,
      filters: {
        State: query.state,
        District: query.district,
        Market: query.market,
        Commodity: query.commodity,
        Variety: query.variety,
        Arrival_Date: query.arrivalDate,
      },
      limit: query.limit,
      offset: query.offset,
    });

    return {
      source: "primary",
      count: records.length,
      records: records.map(normalizePrimaryRecord),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn("Primary mandi price dataset failed, falling back to legacy dataset", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const fallbackRecords = await fetchDataGovResource<FallbackRawRecord>({
    resourceId: FALLBACK_RESOURCE_ID,
    apiKey,
    filters: {
      state: query.state,
      district: query.district,
      market: query.market,
      commodity: query.commodity,
      variety: query.variety,
      arrival_date: query.arrivalDate,
    },
    limit: query.limit,
    offset: query.offset,
  });

  return {
    source: "fallback",
    count: fallbackRecords.length,
    records: fallbackRecords.map(normalizeFallbackRecord),
    fetchedAt: new Date().toISOString(),
  };
}
