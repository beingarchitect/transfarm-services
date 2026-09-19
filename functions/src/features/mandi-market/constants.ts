export const DATA_GOV_BASE_URL = "https://api.data.gov.in/resource";

/**
 * "Variety-wise Daily Market Prices Data of Commodity"
 * Newer dataset, richer fields, but reported to intermittently 502.
 * Filters use PascalCase keys, e.g. filters[State], filters[Arrival_Date].
 */
export const PRIMARY_RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";

/**
 * "Current Daily Price of Various Commodities from Various Markets (Mandi)"
 * Older, more stable dataset used as a fallback when the primary dataset
 * errors out. Filters use lowercase keys, e.g. filters[state].
 */
export const FALLBACK_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

export const DEFAULT_RECORD_LIMIT = 100;
export const MAX_RECORD_LIMIT = 500;
