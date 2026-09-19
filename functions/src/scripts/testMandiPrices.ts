/**
 * Standalone script to exercise `getMandiPrices` (the same service function
 * backing the `getMandiMarketPrices` Cloud Function) against the real
 * data.gov.in API, without needing the Firebase emulator or a deployed
 * function.
 *
 * Usage (from transfarm-services/functions):
 *   npm run build
 *   DATA_GOV_API_KEY=your-key node lib/scripts/testMandiPrices.js
 *
 * Optional overrides (all optional, matching mandiPriceQuerySchema):
 *   MANDI_STATE, MANDI_DISTRICT, MANDI_MARKET, MANDI_COMMODITY,
 *   MANDI_VARIETY, MANDI_ARRIVAL_DATE (DD/MM/YYYY), MANDI_LIMIT
 *
 * Defaults to the sample filters reported not to work from the app:
 * commodity "Ragi(Finger Millet)" at the "Ramanagara APMC" market.
 */
import { getMandiPrices } from "../features/market/service";
import { mandiPriceQuerySchema } from "../features/market/types";

async function main() {
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) {
    console.error(
      "Missing DATA_GOV_API_KEY. Set it in the environment before running this script, e.g.:\n" +
        "  DATA_GOV_API_KEY=your-key node lib/scripts/testMandiPrices.js",
    );
    process.exitCode = 1;
    return;
  }

  const query = mandiPriceQuerySchema.parse({
    state: process.env.MANDI_STATE ?? "Karnataka",
    market: process.env.MANDI_MARKET ?? "Ramanagara APMC",
    commodity: process.env.MANDI_COMMODITY ?? "Ragi(Finger Millet)",
    district: process.env.MANDI_DISTRICT,
    variety: process.env.MANDI_VARIETY,
    arrivalDate: process.env.MANDI_ARRIVAL_DATE,
    limit: process.env.MANDI_LIMIT ? Number(process.env.MANDI_LIMIT) : undefined,
  });

  console.log("Query:", query);

  const result = await getMandiPrices(query, apiKey);

  console.log(`\nSource dataset: ${result.source}`);
  console.log(`Fetched at: ${result.fetchedAt}`);
  console.log(`Record count: ${result.count}\n`);

  for (const record of result.records) {
    console.log(
      `${record.arrivalDate}  ${record.commodity} (${record.variety || "-"})  ` +
        `${record.market}, ${record.district}, ${record.state}  ` +
        `min=${record.minPrice} max=${record.maxPrice} modal=${record.modalPrice}`,
    );
  }
}

main().catch((err) => {
  console.error("Request failed:", err);
  process.exitCode = 1;
});
