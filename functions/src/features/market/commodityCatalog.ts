/**
 * Default/fallback commodity catalog, grouped by category, matching the
 * naming used by data.gov.in's mandi price datasets.
 *
 * There is no practical way to derive "the commodities available in
 * state X" live from the price dataset: a single state can have millions
 * of price records with no facet/distinct API, and the dataset's own
 * metadata doesn't even declare Commodity as dependent on State (only
 * District is). Even data.gov.in's own UI and third-party clients built
 * against this API (e.g. the `agmarknet` PyPI package) ship a static
 * commodity list for this reason - so this list is used to lazily seed
 * Firestore's `marketCommodities/{state}` collection the first time a
 * given state is requested (see `commodityService.ts`), rather than
 * hardcoding it into the Flutter app. That lets it be edited directly in
 * Firestore later (e.g. to curate per state) without an app release.
 */
export const DEFAULT_COMMODITY_CATALOG: Record<string, string[]> = {
  Cereals: [
    "Wheat",
    "Paddy(Dhan)",
    "Rice",
    "Maize",
    "Jowar(Sorghum)",
    "Bajra(Pearl Millet)",
    "Ragi(Finger Millet)",
    "Barley",
  ],
  Pulses: [
    "Arhar (Tur/Red Gram)",
    "Bengal Gram(Gram)",
    "Green Gram (Moong)",
    "Black Gram (Urad)",
    "Lentil (Masur)",
    "Peas Wet",
    "Cowpea (Lobia)",
  ],
  Oilseeds: [
    "Groundnut",
    "Soyabean",
    "Mustard",
    "Sunflower",
    "Sesamum(Sesame,Gingelly,Til)",
    "Castor Seed",
    "Niger Seed",
    "Linseed",
    "Safflower",
    "Copra",
  ],
  "Cash Crops": [
    "Cotton",
    "Sugarcane",
    "Jute",
    "Mesta",
    "Tobacco",
    "Coffee",
    "Tea",
    "Rubber",
    "Arecanut(Betelnut/Supari)",
    "Cashewnuts",
  ],
  Vegetables: [
    "Onion",
    "Potato",
    "Tomato",
    "Brinjal",
    "Cabbage",
    "Cauliflower",
    "Green Chilli",
    "Bhindi(Ladies Finger)",
    "Bottle Gourd",
    "Bitter Gourd",
    "Cucumber",
    "Carrot",
    "Beetroot",
    "Radish",
    "French Beans (Frasbean)",
    "Capsicum",
    "Garlic",
    "Ginger(Green)",
    "Peas Cod",
  ],
  Fruits: [
    "Banana",
    "Mango",
    "Papaya",
    "Apple",
    "Grapes",
    "Orange",
    "Pomegranate",
    "Guava",
    "Water Melon",
    "Muskmelon",
    "Sweet Lime",
    "Lemon",
    "Pineapple",
    "Coconut",
  ],
  Spices: [
    "Turmeric",
    "Coriander(Leaves)",
    "Cumin(Jeera)",
    "Dry Chillies",
    "Black Pepper",
    "Cardamom",
    "Fenugreek(Methi Seed)",
    "Ajwan",
  ],
};

/** Flat, deduplicated, alphabetically-sorted list of all default commodities. */
export function flattenDefaultCatalog(): string[] {
  const names = new Set(Object.values(DEFAULT_COMMODITY_CATALOG).flat());
  return [...names].sort();
}

/** Looks up the category for a given commodity name from the catalog. */
export function findCategoryForCommodity(
  commodity: string,
  catalog: Record<string, string[]> = DEFAULT_COMMODITY_CATALOG,
): string | null {
  const clean = commodity.trim().toLowerCase();
  for (const [category, items] of Object.entries(catalog)) {
    if (items.some((item) => item.trim().toLowerCase() === clean)) {
      return category;
    }
  }
  return null;
}

