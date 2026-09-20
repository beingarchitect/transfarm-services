import { fetchJson } from "../../common/httpClient";
import { DATA_GOV_BASE_URL } from "./constants";
import { DataGovApiResponse } from "./types";

export interface FetchResourceOptions {
  resourceId: string;
  apiKey: string;
  /** Filter keys as expected by the given resource (case differs per dataset). */
  filters?: Record<string, string | undefined>;
  sort?: Record<string, "asc" | "desc">;
  limit: number;
  offset: number;
}

/**
 * Fetches records from a data.gov.in resource ("api.data.gov.in/resource/<id>"),
 * applying `filters[<key>]=<value>` and `sort[<key>]=<dir>` query params as the API expects.
 */
export async function fetchDataGovResource<T>({
  resourceId,
  apiKey,
  filters = {},
  sort,
  limit,
  offset,
}: FetchResourceOptions): Promise<T[]> {
  const url = new URL(`${DATA_GOV_BASE_URL}/${resourceId}`);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(`filters[${key}]`, value);
    }
  }

  if (sort) {
    for (const [key, direction] of Object.entries(sort)) {
      url.searchParams.set(`sort[${key}]`, direction);
    }
  }

  const data = await fetchJson<DataGovApiResponse<T>>(url.toString());

  if (!Array.isArray(data.records)) {
    throw new Error(`Unexpected response shape from data.gov.in resource ${resourceId}`);
  }

  return data.records;
}
