import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Karnataka 31 districts and their taluks
const KARNATAKA_DISTRICTS_AND_TALUKS: Record<string, string[]> = {
  Bagalkote: ["Badami", "Bagalkot", "Bilgi", "Guledgudda", "Hungund", "Ilkal", "Jamkhandi", "Mudhol", "Rabkavi Banhatti", "Terdal"],
  Ballari: ["Ballari", "Kampli", "Kurugodu", "Sandur", "Siruguppa"],
  Belagavi: ["Athani", "Bailhongal", "Belagavi", "Chikkodi", "Gokak", "Hukkeri", "Kagawad", "Khanapur", "Kittur", "Mudalgi", "Nippani", "Ramdurg", "Raybag", "Sankeshwar", "Saundatti", "Yaragatti"],
  "Bengaluru Rural": ["Devanahalli", "Doddaballapur", "Hoskote", "Nelamangala"],
  "Bengaluru Urban": ["Anekal", "Bengaluru East", "Bengaluru North", "Bengaluru South", "Yelahanka"],
  Bidar: ["Aurad", "Basavakalyan", "Bhalki", "Bidar", "Chitgoppa", "Hulsoor", "Humnabad", "Kamalnagar"],
  Chamarajanagar: ["Chamarajanagar", "Gundlupet", "Hanur", "Kollegal", "Yelandur"],
  Chikkaballapur: ["Bagepalli", "Chelur", "Chikkaballapur", "Chintamani", "Gowribidanur", "Gudibanda", "Sidlaghatta"],
  Chikkamagaluru: ["Ajjampura", "Chikkamagaluru", "Kadur", "Kalasa", "Koppa", "Mudigere", "Narasimharajapura", "Sringeri", "Tarikere"],
  Chitradurga: ["Challakere", "Chitradurga", "Hiriyur", "Holalkere", "Hosadurga", "Molakalmuru"],
  "Dakshina Kannada": ["Bantwal", "Belthangady", "Kadaba", "Mangaluru", "Moodabidri", "Puttur", "Sullia"],
  Davanagere: ["Channagiri", "Davanagere", "Harihara", "Honnali", "Jagalur", "Nyamathi"],
  Dharwad: ["Alnavar", "Annigeri", "Dharwad", "Hubballi (Rural)", "Hubballi (Urban)", "Kalghatgi", "Kundgol", "Navalgund"],
  Gadag: ["Gadag", "Gajendragad", "Lakshmeshwar", "Mundargi", "Nargund", "Ron", "Shirahatti"],
  Hassan: ["Alur", "Arkalgud", "Arasikere", "Belur", "Channarayapatna", "Hassan", "Holenarasipura", "Sakaleshpura"],
  Haveri: ["Byadgi", "Hangal", "Haveri", "Hirekerur", "Ranebennur", "Rattihalli", "Savanur", "Shiggaon"],
  Kalaburagi: ["Afzalpur", "Aland", "Chincholi", "Chittapur", "Jewargi", "Kalaburagi", "Kamalapur", "Sedam", "Shahabad", "Yedrami"],
  Kodagu: ["Kushalnagar", "Madikeri", "Ponnampet", "Somwarpet", "Virajpet"],
  Kolar: ["Bangarpet", "Kolar", "Malur", "Mulbagal", "Robertsonpet", "Srinivaspur"],
  Koppal: ["Gangavathi", "Karatagi", "Koppal", "Kukanoor", "Kushtagi", "Yelburga"],
  Mandya: ["Krishnarajapet", "Maddur", "Malavalli", "Mandya", "Nagamangala", "Pandavapura", "Srirangapatna"],
  Mysuru: ["H.D. Kote", "Hunsur", "K.R. Nagar", "Mysuru", "Nanjangud", "Periyapatna", "Saragur", "T. Narasipura"],
  Raichur: ["Devadurga", "Lingsugur", "Manvi", "Maski", "Raichur", "Sindhanur", "Sirwar"],
  Ramanagara: ["Channapatna", "Harohalli", "Kanakapura", "Magadi", "Ramanagara"],
  Shivamogga: ["Bhadravathi", "Hosanagara", "Sagar", "Shikaripura", "Shivamogga", "Soraba", "Thirthahalli"],
  Tumakuru: ["Chikkanayakanahalli", "Gubbi", "Koratagere", "Kunigal", "Madhugiri", "Pavagada", "Sira", "Tiptur", "Tumakuru", "Turuvekere"],
  Udupi: ["Brahmavara", "Byndoor", "Karkala", "Kaup", "Kundapura", "Udupi"],
  "Uttara Kannada": ["Ankola", "Bhatkal", "Dandeli", "Haliyal", "Honnavar", "Joida", "Karwar", "Kumta", "Mundgod", "Siddapura", "Sirsi", "Yellapur"],
  Vijayanagara: ["Hadagali", "Hagaribommanahalli", "Harapanahalli", "Hosapete", "Kotturu", "Kudligi"],
  Vijayapura: ["Babaleshwar", "Basavana Bagewadi", "Chadchan", "Devarahippargi", "Indi", "Kolhar", "Muddebihal", "Nidagundi", "Sindgi", "Talikoti", "Tikota", "Vijayapura"],
  Yadgir: ["Gurmitkal", "Hunsagi", "Shahapur", "Shorapur", "Vadagera", "Yadgir"],
};

// Key states in India
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal"
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Labour", description: "Daily wages, piece-rate, and contract labour" },
  { name: "Seeds & Plants", description: "Seedlings, saplings, nursery, and hybrid seeds" },
  { name: "Fertilizers", description: "Organic manure, compost, chemical fertilizers, DAP, urea" },
  { name: "Pesticides", description: "Insecticides, fungicides, herbicides, and crop protection sprays" },
  { name: "Equipment", description: "Tractor hire, harvester rentals, tools, and implements" },
  { name: "Fuel", description: "Diesel, petrol, oil, and generator fuel" },
  { name: "Water & Irrigation", description: "Drip, sprinkler, pump repairs, borewell, electricity" },
  { name: "Transport", description: "Vehicle rental, produce hauling to APMC, logistics" },
  { name: "Maintenance", description: "Fencing, sheds, pipeline repairs, farm infrastructure" },
  { name: "Miscellaneous", description: "Other general farm operational expenses" },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Crop Sales", description: "Revenue from harvest sold at APMC or to buyers" },
  { name: "By-product Sales", description: "Sale of fodder, husk, straw, wood, compost" },
  { name: "Government Subsidies", description: "PM-Kisan, state schemes, solar/drip subsidy" },
  { name: "Equipment Rental", description: "Leasing tractor, harvester, or machinery to others" },
  { name: "Miscellaneous Income", description: "Other agricultural and farm income" },
];

async function main() {
  const possibleKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, "../../../../transfarm-app/scripts/serviceAccountKey.json"),
    path.resolve(__dirname, "../../serviceAccountKey.json"),
  ].filter((p): p is string => !!p && fs.existsSync(p));

  if (getApps().length === 0) {
    if (possibleKeyPaths.length > 0) {
      console.log(`Using service account: ${possibleKeyPaths[0]}`);
      initializeApp({ credential: cert(possibleKeyPaths[0]) });
    } else {
      console.log("Initializing Firebase Admin with default credentials...");
      initializeApp();
    }
  }

  const db = getFirestore();

  console.log("1. Seeding masterData/locations_IN...");
  const statesMap: Record<string, { districts: Record<string, string[]> }> = {};
  for (const st of INDIAN_STATES) {
    if (st === "Karnataka") {
      statesMap[st] = { districts: KARNATAKA_DISTRICTS_AND_TALUKS };
    } else {
      statesMap[st] = { districts: {} };
    }
  }

  await db.collection("masterData").doc("locations_IN").set({
    country: "India",
    countryCode: "IN",
    states: statesMap,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`   - Seeded ${INDIAN_STATES.length} Indian States`);
  console.log(`   - Seeded 31 Karnataka Districts with ${Object.values(KARNATAKA_DISTRICTS_AND_TALUKS).flat().length} Taluks`);

  console.log("2. Seeding masterData/default_expense_categories...");
  await db.collection("masterData").doc("default_expense_categories").set({
    categories: DEFAULT_EXPENSE_CATEGORIES,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`   - Seeded ${DEFAULT_EXPENSE_CATEGORIES.length} default expense categories`);

  console.log("3. Seeding masterData/default_income_categories...");
  await db.collection("masterData").doc("default_income_categories").set({
    categories: DEFAULT_INCOME_CATEGORIES,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`   - Seeded ${DEFAULT_INCOME_CATEGORIES.length} default income categories`);

  console.log("Master data successfully seeded into Firestore /masterData!");
}

main().catch((err) => {
  console.error("Error seeding master data:", err);
  process.exit(1);
});
