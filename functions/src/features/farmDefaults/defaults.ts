import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

// No Admin SDK setup in this file, so the seed script and tests can import it.

const SUPPORTED_LANGUAGES = ["en", "hi", "kn"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

const itemSchema = z.object({
  /** Saved on the farm's copy as `defaultKey`; never changes when a name is reworded. */
  key: z.string().regex(/^[a-z0-9_]+$/),
  /** English, as plain text: older app versions read this field directly. */
  name: z.string().min(1),
  translations: z.object({ hi: z.string().min(1), kn: z.string().min(1) }),
  /** English only for now, so it's left off farms created in other languages. */
  description: z.string().optional(),
});
export type FarmListItem = z.infer<typeof itemSchema>;

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

/**
 * Written to `masterData` by `npm run seed:master`, so the lists can change
 * without a release. Also the fallback if a document can't be read, so a new
 * farm still gets its lists.
 */
export const DEFAULT_FARM_LISTS: FarmLists = {
  expenseCategories: [
    { key: "labour", name: "Labour", translations: { hi: "मज़दूरी", kn: "ಕೂಲಿ" }, description: "Daily wages, piece-rate, and contract labour" },
    { key: "seeds_plants", name: "Seeds & Plants", translations: { hi: "बीज और पौधे", kn: "ಬೀಜ ಮತ್ತು ಸಸಿಗಳು" }, description: "Seedlings, saplings, nursery, and hybrid seeds" },
    { key: "fertilizers", name: "Fertilizers", translations: { hi: "उर्वरक", kn: "ಗೊಬ್ಬರ" }, description: "Organic manure, compost, chemical fertilizers, DAP, urea" },
    { key: "pesticides", name: "Pesticides", translations: { hi: "कीटनाशक", kn: "ಕೀಟನಾಶಕ" }, description: "Insecticides, fungicides, herbicides, and crop protection sprays" },
    { key: "equipment", name: "Equipment", translations: { hi: "उपकरण", kn: "ಉಪಕರಣಗಳು" }, description: "Tractor hire, harvester rentals, tools, and implements" },
    { key: "fuel", name: "Fuel", translations: { hi: "ईंधन", kn: "ಇಂಧನ" }, description: "Diesel, petrol, oil, and generator fuel" },
    { key: "water_irrigation", name: "Water & Irrigation", translations: { hi: "पानी और सिंचाई", kn: "ನೀರು ಮತ್ತು ನೀರಾವರಿ" }, description: "Drip, sprinkler, pump repairs, borewell, electricity" },
    { key: "transport", name: "Transport", translations: { hi: "परिवहन", kn: "ಸಾರಿಗೆ" }, description: "Vehicle rental, produce hauling to APMC, logistics" },
    { key: "maintenance", name: "Maintenance", translations: { hi: "रखरखाव", kn: "ನಿರ್ವಹಣೆ" }, description: "Fencing, sheds, pipeline repairs, farm infrastructure" },
    { key: "miscellaneous", name: "Miscellaneous", translations: { hi: "अन्य", kn: "ಇತರೆ" }, description: "Other general farm operational expenses" },
  ],
  incomeCategories: [
    { key: "crop_sales", name: "Crop Sales", translations: { hi: "फसल बिक्री", kn: "ಬೆಳೆ ಮಾರಾಟ" }, description: "Revenue from harvest sold at APMC or to buyers" },
    { key: "by_product_sales", name: "By-product Sales", translations: { hi: "उप-उत्पाद बिक्री", kn: "ಉಪ ಉತ್ಪನ್ನ ಮಾರಾಟ" }, description: "Sale of fodder, husk, straw, wood, compost" },
    { key: "government_subsidies", name: "Government Subsidies", translations: { hi: "सरकारी सब्सिडी", kn: "ಸರ್ಕಾರಿ ಸಹಾಯಧನ" }, description: "PM-Kisan, state schemes, solar/drip subsidy" },
    { key: "equipment_rental", name: "Equipment Rental", translations: { hi: "उपकरण किराया", kn: "ಉಪಕರಣ ಬಾಡಿಗೆ" }, description: "Leasing tractor, harvester, or machinery to others" },
    { key: "miscellaneous", name: "Miscellaneous Income", translations: { hi: "अन्य आय", kn: "ಇತರೆ ಆದಾಯ" }, description: "Other agricultural and farm income" },
  ],
  inventoryCategories: [
    { key: "seeds", name: "Seeds", translations: { hi: "बीज", kn: "ಬೀಜಗಳು" } },
    { key: "fertilizers", name: "Fertilizers", translations: { hi: "उर्वरक", kn: "ಗೊಬ್ಬರ" } },
    { key: "pesticides", name: "Pesticides", translations: { hi: "कीटनाशक", kn: "ಕೀಟನಾಶಕ" } },
    { key: "tools_equipment", name: "Tools & Equipment", translations: { hi: "औज़ार और उपकरण", kn: "ಸಲಕರಣೆ ಮತ್ತು ಉಪಕರಣಗಳು" } },
    { key: "fuel", name: "Fuel", translations: { hi: "ईंधन", kn: "ಇಂಧನ" } },
    { key: "other", name: "Other", translations: { hi: "अन्य", kn: "ಇತರೆ" } },
  ],
  contactRoles: [
    { key: "labourer", name: "Labourer", translations: { hi: "मज़दूर", kn: "ಕೂಲಿ ಕಾರ್ಮಿಕ" } },
    { key: "supplier", name: "Supplier", translations: { hi: "आपूर्तिकर्ता", kn: "ಪೂರೈಕೆದಾರ" } },
    { key: "buyer", name: "Buyer", translations: { hi: "खरीदार", kn: "ಖರೀದಿದಾರ" } },
    { key: "trader_agent", name: "Trader/Agent", translations: { hi: "व्यापारी/एजेंट", kn: "ವ್ಯಾಪಾರಿ/ಏಜೆಂಟ್" } },
    { key: "mechanic", name: "Mechanic", translations: { hi: "मैकेनिक", kn: "ಮೆಕ್ಯಾನಿಕ್" } },
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
