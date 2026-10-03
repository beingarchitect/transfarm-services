import { z } from "zod";
import { DEFAULT_RECORD_LIMIT, MAX_RECORD_LIMIT } from "./constants";

/** Request shape accepted by the `getMandiMarketPrices` callable function. */
export const mandiPriceQuerySchema = z.object({
  state: z.string().trim().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  market: z.string().trim().min(1).optional(),
  commodity: z.string().trim().min(1).optional(),
  variety: z.string().trim().min(1).optional(),
  /** Format: DD/MM/YYYY, matching data.gov.in's Arrival_Date convention. */
  arrivalDate: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "arrivalDate must be in DD/MM/YYYY format")
    .optional(),
  limit: z.number().int().positive().max(MAX_RECORD_LIMIT).default(DEFAULT_RECORD_LIMIT),
  offset: z.number().int().nonnegative().default(0),
  forceRefresh: z.boolean().optional().default(false),
});

export type MandiPriceQuery = z.infer<typeof mandiPriceQuerySchema>;

/** Request shape accepted by the `getMarketCommodities` callable function. */
export const marketCommoditiesQuerySchema = z.object({
  state: z.string().trim().min(1),
});

export type MarketCommoditiesQuery = z.infer<typeof marketCommoditiesQuerySchema>;

/** Which upstream dataset or cache served the normalized records. */
export type MandiDataSource = "primary" | "fallback" | "firestore";

/** Normalized market price record, independent of which upstream dataset produced it. */
export interface NormalizedMandiPrice {
  state: string;
  district: string;
  market: string;
  commodity: string;
  category?: string | null;
  variety: string;
  grade: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  modalPrice: number | null;
  /** Format: DD/MM/YYYY, as reported by the upstream dataset. */
  arrivalDate: string;
}

export interface MandiPriceResponse {
  source: MandiDataSource;
  count: number;
  total?: number;
  records: NormalizedMandiPrice[];
  fetchedAt: string;
}

/** A compact date-price pair for sparklines and charts. */
export interface ChartPoint {
  /** Arrival date in DD/MM/YYYY format. */
  d: string;
  /** Modal price in rupees per quintal. */
  p: number;
}

/** Lightweight summary for a commodity card on the watchlist screen. */
export interface MandiCommoditySummary {
  commodity: string;
  category: string | null;
  /** Most recent published record matching farm location or state. */
  latest: NormalizedMandiPrice | null;
  /** Chronologically sorted historical price points for 1-2 year trend chart. */
  chartPoints: ChartPoint[];
  /** Upstream dataset or cache source. */
  source: MandiDataSource;
  fetchedAt: string;
}

/** Query schema for lightweight summary. */
export const mandiSummaryQuerySchema = z.object({
  state: z.string().trim().min(1),
  commodity: z.string().trim().min(1),
  district: z.string().trim().optional(),
  taluk: z.string().trim().optional(),
  village: z.string().trim().optional(),
  hobli: z.string().trim().optional(),
  market: z.string().trim().optional(),
});

export type MandiSummaryQuery = z.infer<typeof mandiSummaryQuerySchema>;

/** Raw record shape from the primary ("Variety-wise Daily Market Prices") resource. */
export interface PrimaryRawRecord {
  State?: string;
  District?: string;
  Market?: string;
  Commodity?: string;
  Variety?: string;
  Grade?: string;
  Min_Price?: string | number;
  Max_Price?: string | number;
  Modal_Price?: string | number;
  Arrival_Date?: string;
}

/** Raw record shape from the fallback ("Current Daily Price of Various Commodities") resource. */
export interface FallbackRawRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
  arrival_date?: string;
}

export interface DataGovApiResponse<T> {
  records: T[];
  total?: number;
  count?: number;
}
