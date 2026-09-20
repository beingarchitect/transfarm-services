import { logger } from "firebase-functions";
import { fetchDataGovResource } from "./dataGovClient";
import { FALLBACK_RESOURCE_ID, PRIMARY_RESOURCE_ID } from "./constants";
import { normalizeFallbackRecord, normalizePrimaryRecord } from "./normalize";
import { getStoredMandiPrices, saveMandiPricesToStorage } from "./priceStorageService";
import { FallbackRawRecord, MandiPriceQuery, MandiPriceResponse, NormalizedMandiPrice, PrimaryRawRecord } from "./types";

/**
 * Fetches mandi market prices.
 *
 * 1. Checks structured Firestore cache under `mandiPrices/{state}/commodities/{commodity}/years/{year}`
 *    first if state & commodity are specified.
 * 2. If cached and fresh (within 12 hours), serves directly from Firestore (sub-100ms, 0 external API calls).
 * 3. On cache miss or stale, fetches from data.gov.in (trying primary, then fallback).
 * 4. Saves newly fetched records into the structured Firestore store for future instant lookups.
 * 5. If data.gov.in is down (e.g. 502/timeout), gracefully falls back to any existing stored records.
 */
export async function getMandiPrices(query: MandiPriceQuery, apiKey: string): Promise<MandiPriceResponse> {
  let storedFallback: { records: NormalizedMandiPrice[]; updatedAt: string | null } | null = null;

  // 1. Check Firestore cache when state and commodity are present
  if (query.state && query.commodity) {
    try {
      const stored = await getStoredMandiPrices(query.state, query.commodity);
      storedFallback = stored;

      if (stored.isFresh && stored.records.length > 0) {
        logger.info(
          `Serving ${stored.records.length} mandi prices for ${query.state}/${query.commodity} directly from Firestore cache`,
        );

        let filtered = stored.records;
        if (query.market) {
          filtered = filtered.filter((r) => r.market.toLowerCase().includes(query.market!.toLowerCase()));
        }
        if (query.variety) {
          filtered = filtered.filter((r) => r.variety.toLowerCase().includes(query.variety!.toLowerCase()));
        }
        if (query.arrivalDate) {
          filtered = filtered.filter((r) => r.arrivalDate === query.arrivalDate);
        }

        return {
          source: "firestore",
          count: filtered.length,
          records: filtered,
          fetchedAt: stored.updatedAt ?? new Date().toISOString(),
        };
      }
    } catch (cacheErr) {
      logger.warn("Failed to check Firestore mandi price cache, proceeding with live fetch", {
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
    }
  }

  // 2. Fetch live from data.gov.in (primary resource)
  let liveResult: MandiPriceResponse | null = null;
  // Always fetch a generous batch (up to 500) so the Firestore cache is rich
  const fetchLimit = Math.max(query.limit, 500);

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
      sort: {
        Arrival_Date: "desc",
      },
      limit: fetchLimit,
      offset: query.offset,
    });

    liveResult = {
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

  // 3. Fallback to older data.gov.in dataset if primary failed
  if (!liveResult) {
    try {
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
        sort: {
          arrival_date: "desc",
        },
        limit: fetchLimit,
        offset: query.offset,
      });

      liveResult = {
        source: "fallback",
        count: fallbackRecords.length,
        records: fallbackRecords.map(normalizeFallbackRecord),
        fetchedAt: new Date().toISOString(),
      };
    } catch (fallbackErr) {
      logger.error("Both data.gov.in datasets failed", {
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      });
    }
  }

  // 4. Save to Firestore cache if we got records and have state + commodity
  if (liveResult && liveResult.records.length > 0 && query.state && query.commodity) {
    try {
      await saveMandiPricesToStorage(query.state, query.commodity, liveResult.records);
    } catch (saveErr) {
      logger.warn("Failed to save mandi prices to Firestore storage", {
        error: saveErr instanceof Error ? saveErr.message : String(saveErr),
      });
    }
  }

  // 5. If live fetch succeeded, return it (respecting caller's limit)
  if (liveResult) {
    const limitedRecords = liveResult.records.slice(0, query.limit);
    return {
      ...liveResult,
      count: limitedRecords.length,
      records: limitedRecords,
    };
  }

  // 6. If both live fetches failed, but we had existing Firestore cache (even if stale), return it
  if (storedFallback && storedFallback.records.length > 0) {
    logger.warn("Live API unavailable; serving stale Firestore mandi prices", {
      state: query.state,
      commodity: query.commodity,
    });
    return {
      source: "firestore",
      count: storedFallback.records.length,
      records: storedFallback.records,
      fetchedAt: storedFallback.updatedAt ?? new Date().toISOString(),
    };
  }

  throw new Error("Unable to fetch mandi market prices from live API or cache.");
}

