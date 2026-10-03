/**
 * Official APMC Mandi markets in Karnataka grouped by District,
 * matching naming conventions from Agmarknet / data.gov.in.
 */
export const KARNATAKA_MARKETS_BY_DISTRICT: Record<string, string[]> = {
  Ramanagara: ["Channapatna", "Kanakapura", "Magadi", "Ramanagara"],
  "Bengaluru Urban": ["Bangalore", "Binny Mill (F&V)", "Kadugodi", "Yeshwanthapura"],
  "Bengaluru Rural": ["Devanahalli", "Doddaballapur", "Hoskote", "Nelamangala"],
  Kolar: ["Bangarpet", "Kolar", "Malur", "Mulbagal", "Srinivaspur"],
  Chikkaballapur: ["Bagepalli", "Chikkaballapur", "Chintamani", "Gowribidanur", "Sidlaghatta"],
  Mandya: ["Krishnarajapet", "Maddur", "Malavalli", "Mandya", "Nagamangala", "Pandavapura", "Srirangapatna"],
  Mysuru: ["H.D. Kote", "Hunsur", "K.R. Nagar", "Mysore (Bandipalya)", "Nanjangud", "Piriyapatna", "T.Narasipura"],
  Chamarajanagar: ["Chamarajanagar", "Gundlupet", "Kollegal", "Santhemarahalli", "Yelandur"],
  Hassan: ["Alur", "Arkalgud", "Arasikere", "Belur", "Channarayapatna", "Hassan", "Holenarasipura", "Sakaleshpura"],
  Tumakuru: ["Chikkanayakanahalli", "Gubbi", "Koratagere", "Kunigal", "Madhugiri", "Pavagada", "Sira", "Tiptur", "Tumkur", "Turuvekere"],
  Chitradurga: ["Challakere", "Chitradurga", "Hiriyur", "Holalkere", "Hosadurga", "Molakalmuru"],
  Davanagere: ["Channagiri", "Davangere", "Harihara", "Honnali", "Jagalur"],
  Shivamogga: ["Bhadravathi", "Hosanagara", "Sagar", "Shikaripura", "Shimoga", "Soraba", "Thirthahalli"],
  Udupi: ["Karkala", "Kundapura", "Udupi"],
  "Dakshina Kannada": ["Bantwal", "Belthangady", "Mangalore", "Puttur", "Sulya"],
  Kodagu: ["Madikeri", "Somwarpet", "Virajpet"],
  Chikkamagaluru: ["Chikkamagalore", "Kadur", "Koppa", "Mudigere", "N.R. Pura", "Sringeri", "Tarikere"],
  Ballari: ["Bellary", "Kudligi", "Sandur", "Siruguppa"],
  Vijayanagara: ["Hadagali", "Hagaribommanahalli", "Harapanahalli", "Hospet", "Kotturu"],
  Koppal: ["Gangavathi", "Koppal", "Kushtagi", "Yelburga"],
  Raichur: ["Devadurga", "Lingsugur", "Manvi", "Raichur", "Sindhanur"],
  Kalaburagi: ["Afzalpur", "Aland", "Chincholi", "Chittapur", "Gulbarga", "Jevargi", "Sedam"],
  Bidar: ["Aurad", "Basavakalyan", "Bhalki", "Bidar", "Humnabad"],
  Yadgir: ["Shahapur", "Shorapur", "Yadgir"],
  Belagavi: ["Athani", "Bailhongal", "Belgaum", "Chikkodi", "Gokak", "Hukkeri", "Khanapur", "Kudachi", "Ramdurg", "Raybag", "Sankeshwar", "Saundatti"],
  Dharwad: ["Dharwad", "Hubli (Amaragol)", "Kalghatgi", "Kundgol", "Navalgund"],
  Gadag: ["Gadag", "Mundargi", "Nargund", "Ron", "Shirhatti"],
  Haveri: ["Byadgi", "Hangal", "Haveri", "Hirekerur", "Ranebennur", "Savanur", "Shiggaon"],
  "Uttara Kannada": ["Ankola", "Bhatkal", "Haliyal", "Honavar", "Karwar", "Kumta", "Mundgod", "Siddapura", "Sirsi", "Yellapur"],
  Bagalkote: ["Badami", "Bagalkot", "Bilgi", "Hungund", "Jamkhandi", "Mudhol"],
  Vijayapura: ["Basavana Bagewadi", "Bijapur", "Indi", "Muddebihal", "Sindgi"],
};

/** Flattened sorted unique list of all APMC markets in Karnataka. */
export function getKarnatakaMarkets(): string[] {
  const set = new Set<string>();
  for (const markets of Object.values(KARNATAKA_MARKETS_BY_DISTRICT)) {
    for (const m of markets) {
      set.add(m);
    }
  }
  return Array.from(set).sort();
}
