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
});

export type MandiPriceQuery = z.infer<typeof mandiPriceQuerySchema>;

/** Which upstream dataset a normalized record (or the overall response) came from. */
export type MandiDataSource = "primary" | "fallback";

/** Normalized market price record, independent of which upstream dataset produced it. */
export interface NormalizedMandiPrice {
  state: string;
  district: string;
  market: string;
  commodity: string;
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
  records: NormalizedMandiPrice[];
  fetchedAt: string;
}

/** Raw record shape from the primary ("Variety-wise Daily Market Prices") resource. */
export interface PrimaryRawRecord {
  State?: string;
  District?: string;
  Market?: string;
  Commodity?: string;
  Variety?: string;
  Grade?: string;
  "Min Price"?: string | number;
  "Max Price"?: string | number;
  "Modal Price"?: string | number;
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
