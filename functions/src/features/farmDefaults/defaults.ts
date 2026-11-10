import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

// No Admin SDK setup in this file, so the seed script and tests can import it.

const SUPPORTED_LANGUAGES = ["en", "hi", "kn"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

/**
 * Farm types a farmer can pick during setup (several, for a mixed farm).
 * Stored on the farm as `farmProfile.farmTypes`; the app has the same keys.
 */
export const FARM_TYPES = [
  "field_crops",
  "vegetables",
  "fruits",
  "plantation",
  "agroforestry",
  "terrace_garden",
  "livestock",
] as const;
export type FarmType = (typeof FARM_TYPES)[number];

/** The valid farm types in [value], ignoring anything else. */
export function farmTypesFrom(value: unknown): FarmType[] {
  if (!Array.isArray(value)) return [];
  return FARM_TYPES.filter((t) => value.includes(t));
}

/**
 * How the farmer farms (one answer). Stored as `farmProfile.farmingPractice`;
 * the app has the same keys. List items can target these in `onlyFor`.
 */
export const FARMING_PRACTICES = ["chemical", "organic", "natural", "transitioning", "mixed"] as const;
export type FarmingPractice = (typeof FARMING_PRACTICES)[number];

/** [value] if it's a known practice, else null. */
export function farmingPracticeFrom(value: unknown): FarmingPractice | null {
  return FARMING_PRACTICES.includes(value as FarmingPractice) ? (value as FarmingPractice) : null;
}

/** Practices that use organic inputs, at least on part of the farm. */
const ORGANIC_INPUTS = ["organic", "natural", "transitioning", "mixed"];

const itemSchema = z.object({
  /** Saved on the farm's copy as `defaultKey`; never changes when a name is reworded. */
  key: z.string().regex(/^[a-z0-9_]+$/),
  /** English, as plain text: older app versions read this field directly. */
  name: z.string().min(1),
  translations: z.object({ hi: z.string().min(1), kn: z.string().min(1) }),
  /** English only for now, so it's left off farms created in other languages. */
  description: z.string().optional(),
  /**
   * Only for farms with at least one of these farm types or this farming
   * practice (e.g. Milk Sales for livestock, Organic Inputs for organic).
   */
  onlyFor: z.array(z.string()).optional(),
  /**
   * Left out when the farm's *types* are only these (e.g. no Labour for a
   * terrace garden). The practice doesn't count here.
   */
  skipWhenOnly: z.array(z.string()).optional(),
});
export type FarmListItem = z.infer<typeof itemSchema>;

/**
 * The items a farm of [farmTypes] and [practice] starts with. With neither
 * (setup skipped, or an older app) that's every general item, as before
 * these questions existed. The app's setup preview applies the same rules
 * (FarmSetupSource.includedFor).
 */
export function itemsForFarm(
  items: FarmListItem[],
  farmTypes: readonly string[],
  practice: string | null = null,
): FarmListItem[] {
  const tags = practice ? [...farmTypes, practice] : farmTypes;
  return items.filter((item) => {
    if (item.onlyFor && !item.onlyFor.some((t) => tags.includes(t))) return false;
    if (item.skipWhenOnly && farmTypes.length > 0 && farmTypes.every((t) => item.skipWhenOnly!.includes(t))) {
      return false;
    }
    return true;
  });
}

/** What each `masterData` document holds. */
export const farmListDocSchema = z.object({ categories: z.array(itemSchema).min(1) });

/** Keys are the farm subcollections each list is written to. */
export type FarmLists = Record<
  "expenseCategories" | "incomeCategories" | "inventoryCategories" | "contactRoles",
  FarmListItem[]
>;

/** The `masterData` document holding each list. */
export const FARM_LIST_DOCS: Record<keyof FarmLists, string> = {
  expenseCategories: "default_expense_categories",
  incomeCategories: "default_income_categories",
  inventoryCategories: "default_inventory_categories",
  contactRoles: "default_contact_roles",
};

/** A terrace / kitchen garden on its own doesn't hire labour or tractors. */
const TERRACE = ["terrace_garden"] as const;

/**
 * Written to `masterData` by `npm run seed:master`, so the lists can change
 * without a release. Also the fallback if a document can't be read, so a new
 * farm still gets its lists.
 */
export const DEFAULT_FARM_LISTS: FarmLists = {
  expenseCategories: [
    { key: "labour", name: "Labour", translations: { hi: "मज़दूरी", kn: "ಕೂಲಿ" }, description: "Daily wages, piece-rate, and contract labour", skipWhenOnly: [...TERRACE] },
    { key: "seeds_plants", name: "Seeds & Plants", translations: { hi: "बीज और पौधे", kn: "ಬೀಜ ಮತ್ತು ಸಸಿಗಳು" }, description: "Seedlings, saplings, nursery, and hybrid seeds" },
    { key: "fertilizers", name: "Fertilizers", translations: { hi: "उर्वरक", kn: "ಗೊಬ್ಬರ" }, description: "Organic manure, compost, chemical fertilizers, DAP, urea" },
    { key: "pesticides", name: "Pesticides", translations: { hi: "कीटनाशक", kn: "ಕೀಟನಾಶಕ" }, description: "Insecticides, fungicides, herbicides, and crop protection sprays" },
    { key: "organic_inputs", name: "Organic Inputs", translations: { hi: "जैविक इनपुट", kn: "ಸಾವಯವ ಒಳಸುರಿಗಳು" }, description: "Vermicompost, jeevamrutha, bio-fertilizers, neem and other bio-controls", onlyFor: ORGANIC_INPUTS },
    { key: "organic_certification", name: "Organic Certification", translations: { hi: "जैविक प्रमाणन", kn: "ಸಾವಯವ ಪ್ರಮಾಣೀಕರಣ" }, description: "PGS / NPOP certification, inspection and lab fees", onlyFor: ["organic", "transitioning"] },
    { key: "equipment", name: "Equipment", translations: { hi: "उपकरण", kn: "ಉಪಕರಣಗಳು" }, description: "Tractor hire, harvester rentals, tools, and implements", skipWhenOnly: [...TERRACE] },
    { key: "fuel", name: "Fuel", translations: { hi: "ईंधन", kn: "ಇಂಧನ" }, description: "Diesel, petrol, oil, and generator fuel", skipWhenOnly: [...TERRACE] },
    { key: "water_irrigation", name: "Water & Irrigation", translations: { hi: "पानी और सिंचाई", kn: "ನೀರು ಮತ್ತು ನೀರಾವರಿ" }, description: "Drip, sprinkler, pump repairs, borewell, electricity" },
    { key: "transport", name: "Transport", translations: { hi: "परिवहन", kn: "ಸಾರಿಗೆ" }, description: "Vehicle rental, produce hauling to APMC, logistics", skipWhenOnly: [...TERRACE] },
    { key: "maintenance", name: "Maintenance", translations: { hi: "रखरखाव", kn: "ನಿರ್ವಹಣೆ" }, description: "Fencing, sheds, pipeline repairs, farm infrastructure" },
    { key: "packing_grading", name: "Packing & Grading", translations: { hi: "पैकिंग और ग्रेडिंग", kn: "ಪ್ಯಾಕಿಂಗ್ ಮತ್ತು ಗ್ರೇಡಿಂಗ್" }, description: "Crates, boxes, sorting and grading before sale", onlyFor: ["vegetables", "fruits"] },
    { key: "harvesting", name: "Harvesting & Plucking", translations: { hi: "कटाई और तुड़ाई", kn: "ಕೊಯ್ಲು ಮತ್ತು ಕೀಳುವಿಕೆ" }, description: "Harvest, plucking and climbing charges", onlyFor: ["fruits", "plantation", "agroforestry"] },
    { key: "feed_fodder", name: "Animal Feed & Fodder", translations: { hi: "पशु आहार और चारा", kn: "ಪಶು ಆಹಾರ ಮತ್ತು ಮೇವು" }, description: "Cattle feed, fodder, mineral mixture", onlyFor: ["livestock"] },
    { key: "veterinary", name: "Veterinary & Animal Care", translations: { hi: "पशु चिकित्सा", kn: "ಪಶು ವೈದ್ಯಕೀಯ" }, description: "Vet visits, vaccines, medicines, insemination", onlyFor: ["livestock"] },
    { key: "pots_soil", name: "Pots, Grow Bags & Potting Mix", translations: { hi: "गमले, ग्रो बैग और मिट्टी", kn: "ಕುಂಡ, ಗ್ರೋ ಬ್ಯಾಗ್ ಮತ್ತು ಮಣ್ಣು" }, description: "Containers, grow bags, cocopeat and potting soil", onlyFor: [...TERRACE] },
    { key: "miscellaneous", name: "Miscellaneous", translations: { hi: "अन्य", kn: "ಇತರೆ" }, description: "Other general farm operational expenses" },
  ],
  incomeCategories: [
    { key: "crop_sales", name: "Crop Sales", translations: { hi: "फसल बिक्री", kn: "ಬೆಳೆ ಮಾರಾಟ" }, description: "Revenue from harvest sold at APMC or to buyers" },
    { key: "milk_sales", name: "Milk & Dairy Sales", translations: { hi: "दूध और डेयरी बिक्री", kn: "ಹಾಲು ಮತ್ತು ಡೈರಿ ಮಾರಾಟ" }, description: "Milk to the dairy society, ghee, curd", onlyFor: ["livestock"] },
    { key: "livestock_sales", name: "Livestock Sales", translations: { hi: "पशुधन बिक्री", kn: "ಜಾನುವಾರು ಮಾರಾಟ" }, description: "Sale of cattle, goats, sheep, poultry", onlyFor: ["livestock"] },
    { key: "tree_produce", name: "Timber & Tree Produce", translations: { hi: "लकड़ी और पेड़ों की उपज", kn: "ಮರ ಮತ್ತು ಮರದ ಉತ್ಪನ್ನಗಳು" }, description: "Timber, firewood, fruit and leaves from trees", onlyFor: ["agroforestry", "plantation"] },
    { key: "by_product_sales", name: "By-product Sales", translations: { hi: "उप-उत्पाद बिक्री", kn: "ಉಪ ಉತ್ಪನ್ನ ಮಾರಾಟ" }, description: "Sale of fodder, husk, straw, wood, compost" },
    { key: "government_subsidies", name: "Government Subsidies", translations: { hi: "सरकारी सब्सिडी", kn: "ಸರ್ಕಾರಿ ಸಹಾಯಧನ" }, description: "PM-Kisan, state schemes, solar/drip subsidy" },
    { key: "equipment_rental", name: "Equipment Rental", translations: { hi: "उपकरण किराया", kn: "ಉಪಕರಣ ಬಾಡಿಗೆ" }, description: "Leasing tractor, harvester, or machinery to others", skipWhenOnly: [...TERRACE] },
    { key: "miscellaneous", name: "Miscellaneous Income", translations: { hi: "अन्य आय", kn: "ಇತರೆ ಆದಾಯ" }, description: "Other agricultural and farm income" },
  ],
  inventoryCategories: [
    { key: "seeds", name: "Seeds", translations: { hi: "बीज", kn: "ಬೀಜಗಳು" } },
    { key: "fertilizers", name: "Fertilizers", translations: { hi: "उर्वरक", kn: "ಗೊಬ್ಬರ" } },
    { key: "pesticides", name: "Pesticides", translations: { hi: "कीटनाशक", kn: "ಕೀಟನಾಶಕ" } },
    { key: "organic_inputs", name: "Organic Inputs", translations: { hi: "जैविक इनपुट", kn: "ಸಾವಯವ ಒಳಸುರಿಗಳು" }, onlyFor: ORGANIC_INPUTS },
    { key: "animal_feed", name: "Animal Feed", translations: { hi: "पशु आहार", kn: "ಪಶು ಆಹಾರ" }, onlyFor: ["livestock"] },
    { key: "tools_equipment", name: "Tools & Equipment", translations: { hi: "औज़ार और उपकरण", kn: "ಸಲಕರಣೆ ಮತ್ತು ಉಪಕರಣಗಳು" } },
    { key: "fuel", name: "Fuel", translations: { hi: "ईंधन", kn: "ಇಂಧನ" }, skipWhenOnly: [...TERRACE] },
    { key: "other", name: "Other", translations: { hi: "अन्य", kn: "ಇತರೆ" } },
  ],
  contactRoles: [
    { key: "labourer", name: "Labourer", translations: { hi: "मज़दूर", kn: "ಕೂಲಿ ಕಾರ್ಮಿಕ" }, skipWhenOnly: [...TERRACE] },
    { key: "supplier", name: "Supplier", translations: { hi: "आपूर्तिकर्ता", kn: "ಪೂರೈಕೆದಾರ" } },
    { key: "buyer", name: "Buyer", translations: { hi: "खरीदार", kn: "ಖರೀದಿದಾರ" } },
    { key: "trader_agent", name: "Trader/Agent", translations: { hi: "व्यापारी/एजेंट", kn: "ವ್ಯಾಪಾರಿ/ಏಜೆಂಟ್" }, skipWhenOnly: [...TERRACE] },
    { key: "mechanic", name: "Mechanic", translations: { hi: "मैकेनिक", kn: "ಮೆಕ್ಯಾನಿಕ್" }, skipWhenOnly: [...TERRACE] },
    { key: "veterinarian", name: "Veterinarian", translations: { hi: "पशु चिकित्सक", kn: "ಪಶು ವೈದ್ಯರು" }, onlyFor: ["livestock"] },
    { key: "agriculture_officer", name: "Agriculture Officer", translations: { hi: "कृषि अधिकारी", kn: "ಕೃಷಿ ಅಧಿಕಾರಿ" } },
  ],
};

export interface DefaultDoc {
  subcollection: keyof FarmLists;
  id: string;
  data: Record<string, unknown>;
}

/** The documents to add to a new farm, in the formats the app reads and the rules expect. */
export function buildDefaultDocs(
  farmId: string,
  language: Language,
  lists: FarmLists,
  now: Date,
): DefaultDoc[] {
  const subcollections = Object.keys(lists) as (keyof FarmLists)[];
  return subcollections.flatMap((subcollection) =>
    lists[subcollection].map((item, index) => {
      // Contact roles store timestamps; the category lists store ISO strings.
      const time = subcollection === "contactRoles" ? Timestamp.fromDate(now) : now.toISOString();
      // Millisecond IDs, like the ones the app gives categories users add. The
      // index keeps them unique, as a whole list is created in the same instant.
      const id = String(now.getTime() + index);
      return {
        subcollection,
        id,
        data: {
          id,
          defaultKey: item.key,
          farmId,
          name: language === "en" ? item.name : item.translations[language],
          ...(language === "en" && item.description ? { description: item.description } : {}),
          createdAt: time,
          updatedAt: time,
        },
      };
    }),
  );
}
