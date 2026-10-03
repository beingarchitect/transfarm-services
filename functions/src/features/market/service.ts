import { logger } from "firebase-functions";
import { findCategoryForCommodity } from "./commodityCatalog";
import { fetchDataGovResource } from "./dataGovClient";
import { FALLBACK_RESOURCE_ID, PRIMARY_RESOURCE_ID } from "./constants";
import { normalizeFallbackRecord, normalizePrimaryRecord } from "./normalize";
import { getStoredMandiPrices, saveMandiPricesToStorage } from "./priceStorageService";
import {
  ChartPoint,
  FallbackRawRecord,
  MandiCommoditySummary,
  MandiPriceQuery,
  MandiPriceResponse,
  MandiSummaryQuery,
  NormalizedMandiPrice,
  PrimaryRawRecord,
} from "./types";

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

      if (!query.forceRefresh && stored.records.length > 0) {
        logger.info(
          `Serving ${stored.records.length} mandi prices for ${query.state}/${query.commodity} directly from Firestore cache (fresh: ${stored.isFresh})`,
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

        const total = filtered.length;
        const page = filtered.slice(query.offset, query.offset + query.limit);

        return {
          source: "firestore",
          count: page.length,
          total,
          records: page,
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

  // 5. If live fetch succeeded, return it (respecting caller's limit & offset)
  if (liveResult) {
    const total = liveResult.records.length;
    const page = liveResult.records.slice(query.offset, query.offset + query.limit);
    return {
      ...liveResult,
      count: page.length,
      total,
      records: page,
    };
  }

  // 6. If both live fetches failed, but we had existing Firestore cache (even if stale), return it
  if (storedFallback && storedFallback.records.length > 0) {
    logger.warn("Live API unavailable; serving stale Firestore mandi prices", {
      state: query.state,
      commodity: query.commodity,
    });
    let filtered = storedFallback.records;
    if (query.market) {
      filtered = filtered.filter((r) => r.market.toLowerCase().includes(query.market!.toLowerCase()));
    }
    if (query.variety) {
      filtered = filtered.filter((r) => r.variety.toLowerCase().includes(query.variety!.toLowerCase()));
    }
    if (query.arrivalDate) {
      filtered = filtered.filter((r) => r.arrivalDate === query.arrivalDate);
    }
    const total = filtered.length;
    const page = filtered.slice(query.offset, query.offset + query.limit);
    return {
      source: "firestore",
      count: page.length,
      total,
      records: page,
      fetchedAt: storedFallback.updatedAt ?? new Date().toISOString(),
    };
  }

  throw new Error("Unable to fetch mandi market prices from live API or cache.");
}

/**
 * Returns a lightweight summary for a single tracked commodity card:
 * 1. The most recent published record matching the farm's location.
 * 2. An array of `{ d: date, p: modalPrice }` points across the entire 1-2 year history
 *    for rendering the sparkline curve.
 *
 * This reduces card screen payload from ~150 KB down to ~1.5 KB per crop.
 */
export async function getMandiSummary(
  query: MandiSummaryQuery,
  apiKey: string,
): Promise<MandiCommoditySummary> {
  // 1. Fetch/retrieve the full dataset for this commodity (from Firestore or live API)
  const fullData = await getMandiPrices(
    {
      state: query.state,
      commodity: query.commodity,
      market: query.market,
      limit: 500,
      offset: 0,
      forceRefresh: false,
    },
    apiKey,
  );

  const allRecords = fullData.records;
  const category = findCategoryForCommodity(query.commodity);

  // 2. Filter records by market (if specified) or location (district/taluk/village/hobli)
  let localRecords = allRecords;
  if (query.market && query.market.trim().length > 0) {
    const marketTerm = query.market.trim().toLowerCase();
    const matched = allRecords.filter((r) =>
      r.market.toLowerCase().includes(marketTerm) || marketTerm.includes(r.market.toLowerCase()),
    );
    if (matched.length > 0) {
      localRecords = matched;
    }
  } else {
    const locationTerms = [query.district, query.taluk, query.village, query.hobli]
      .filter((t): t is string => !!t && t.trim().length > 0)
      .map((t) => t.trim().toLowerCase());

    if (locationTerms.length > 0) {
      const matched = allRecords.filter((r) => {
        const d = r.district.toLowerCase();
        const m = r.market.toLowerCase();
        return locationTerms.some(
          (term) => d.includes(term) || m.includes(term) || term.includes(d) || term.includes(m),
        );
      });
      if (matched.length > 0) {
        localRecords = matched;
      }
    }
  }

  // 3. Find latest record (records are already sorted descending)
  const latest = localRecords.length > 0 ? localRecords[0] : null;

  // 4. Build chronological chartPoints (oldest to newest)
  const sortedAsc = [...localRecords]
    .filter((r) => r.modalPrice !== null && r.arrivalDate)
    .sort((a, b) => {
      const parse = (dStr: string) => {
        const parts = dStr.split("/");
        if (parts.length === 3) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
        }
        return 0;
      };
      return parse(a.arrivalDate) - parse(b.arrivalDate);
    });

  // Group by date so each date has a single modal price (averaged if multiple local markets reported)
  const byDate = new Map<string, number[]>();
  for (const r of sortedAsc) {
    const prices = byDate.get(r.arrivalDate) ?? [];
    prices.push(r.modalPrice!);
    byDate.set(r.arrivalDate, prices);
  }

  const chartPoints: ChartPoint[] = [];
  for (const [date, prices] of byDate.entries()) {
    const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
    chartPoints.push({ d: date, p: avgPrice });
  }

  return {
    commodity: query.commodity,
    category,
    latest,
    chartPoints,
    source: fullData.source,
    fetchedAt: fullData.fetchedAt,
  };
}


