/**
 * Official APMC Mandi markets in Karnataka grouped by District,
 * matching naming conventions from Agmarknet / data.gov.in (with APMC suffix).
 */
export const KARNATAKA_MARKETS_BY_DISTRICT: Record<string, string[]> = {
  Ramanagara: ["Channapatna APMC", "Kanakapura APMC", "Magadi APMC", "Ramanagara APMC"],
  "Bengaluru Urban": ["Bangalore APMC", "Binny Mill (F&V) APMC", "Kadugodi APMC", "Yeshwanthapura APMC"],
  "Bengaluru Rural": ["Devanahalli APMC", "Doddaballapur APMC", "Hoskote APMC", "Nelamangala APMC"],
  Kolar: ["Bangarpet APMC", "Kolar APMC", "Malur APMC", "Mulbagal APMC", "Srinivaspur APMC"],
  Chikkaballapur: ["Bagepalli APMC", "Chikkaballapur APMC", "Chintamani APMC", "Gowribidanur APMC", "Sidlaghatta APMC"],
  Mandya: ["Krishnarajapet APMC", "Maddur APMC", "Malavalli APMC", "Mandya APMC", "Nagamangala APMC", "Pandavapura APMC", "Srirangapatna APMC"],
  Mysuru: ["H.D. Kote APMC", "Hunsur APMC", "K.R. Nagar APMC", "Mysore (Bandipalya) APMC", "Nanjangud APMC", "Periyapatna APMC", "T.Narasipura APMC"],
  Chamarajanagar: ["Chamarajanagar APMC", "Gundlupet APMC", "Kollegal APMC", "Santhemarahalli APMC", "Yelandur APMC"],
  Hassan: ["Alur APMC", "Arkalgud APMC", "Arasikere APMC", "Belur APMC", "Channarayapatna APMC", "Hassan APMC", "Holenarasipura APMC", "Sakaleshpura APMC"],
  Tumakuru: ["Chikkanayakanahalli APMC", "Gubbi APMC", "Koratagere APMC", "Kunigal APMC", "Madhugiri APMC", "Pavagada APMC", "Sira APMC", "Tiptur APMC", "Tumkur APMC", "Turuvekere APMC"],
  Chitradurga: ["Challakere APMC", "Chitradurga APMC", "Hiriyur APMC", "Holalkere APMC", "Hosadurga APMC", "Molakalmuru APMC"],
  Davanagere: ["Channagiri APMC", "Davangere APMC", "Harihara APMC", "Honnali APMC", "Jagalur APMC"],
  Shivamogga: ["Bhadravathi APMC", "Hosanagara APMC", "Sagar APMC", "Shikaripura APMC", "Shimoga APMC", "Soraba APMC", "Thirthahalli APMC"],
  Udupi: ["Karkala APMC", "Kundapura APMC", "Udupi APMC"],
  "Dakshina Kannada": ["Bantwal APMC", "Belthangady APMC", "Mangalore APMC", "Puttur APMC", "Sulya APMC"],
  Kodagu: ["Madikeri APMC", "Somwarpet APMC", "Virajpet APMC"],
  Chikkamagaluru: ["Chikkamagalore APMC", "Kadur APMC", "Koppa APMC", "Mudigere APMC", "N.R. Pura APMC", "Sringeri APMC", "Tarikere APMC"],
  Ballari: ["Bellary APMC", "Kudligi APMC", "Sandur APMC", "Siruguppa APMC"],
  Vijayanagara: ["H.B. Halli APMC", "Hadagali APMC", "Hagaribommanahalli APMC", "Harapanahalli APMC", "Hospet APMC", "Kotturu APMC"],
  Koppal: ["Gangavathi APMC", "Koppal APMC", "Kushtagi APMC", "Yelburga APMC"],
  Raichur: ["Devadurga APMC", "Lingsugur APMC", "Manvi APMC", "Raichur APMC", "Sindhanur APMC"],
  Kalaburagi: ["Afzalpur APMC", "Aland APMC", "Chincholi APMC", "Chittapur APMC", "Gulbarga APMC", "Jevargi APMC", "Sedam APMC"],
  Bidar: ["Aurad APMC", "Basavakalyan APMC", "Bhalki APMC", "Bidar APMC", "Humnabad APMC"],
  Yadgir: ["Shahapur APMC", "Shorapur APMC", "Yadgir APMC"],
  Belagavi: ["Athani APMC", "Bailhongal APMC", "Belgaum APMC", "Chikkodi APMC", "Gokak APMC", "Hukkeri APMC", "Khanapur APMC", "Kudachi APMC", "Ramdurg APMC", "Raybag APMC", "Sankeshwar APMC", "Saundatti APMC"],
  Dharwad: ["Dharwad APMC", "Hubli (Amaragol) APMC", "Kalghatgi APMC", "Kundgol APMC", "Navalgund APMC"],
  Gadag: ["Gadag APMC", "Mundargi APMC", "Nargund APMC", "Ron APMC", "Shirhatti APMC"],
  Haveri: ["Byadgi APMC", "Hangal APMC", "Haveri APMC", "Hirekerur APMC", "Ranebennur APMC", "Savanur APMC", "Shiggaon APMC"],
  "Uttara Kannada": ["Ankola APMC", "Bhatkal APMC", "Haliyal APMC", "Honavar APMC", "Karwar APMC", "Kumta APMC", "Mundgod APMC", "Siddapura APMC", "Sirsi APMC", "Yellapur APMC"],
  Bagalkote: ["Badami APMC", "Bagalkot APMC", "Bilgi APMC", "Hungund APMC", "Jamkhandi APMC", "Mudhol APMC"],
  Vijayapura: ["Basavana Bagewadi APMC", "Bijapur APMC", "Indi APMC", "Muddebihal APMC", "Sindgi APMC"],
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
