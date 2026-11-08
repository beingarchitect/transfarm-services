/**
 * Loads a spreadsheet of public contacts (soil testing labs, Krishi Vigyan
 * Kendras, helplines...) into `public_contacts`. Farms pick up the changes the
 * next time their copies sync.
 *
 * Only checks the file and prints a summary unless --write is passed:
 *   npx ts-node src/scripts/importPublicContacts.ts <file.csv> [--write] [--delete-missing]
 *
 * --delete-missing also removes records whose id isn't in the file, so use it
 * only with the complete list. See data/public_contacts.template.csv.
 *
 * Columns: id, name, category, state (or ALL for national), districts and
 * phoneNumbers (several separated by |; no districts means the whole state),
 * email, address, sourceUrl, verifiedOn (YYYY-MM-DD). Other columns, such as
 * reviewNote, are for whoever maintains the sheet and aren't loaded.
 */
import { initFirestore, readCsvRows, splitList } from "./csvImport";

const COLLECTION = "public_contacts";
const CATEGORIES = ["soil_testing", "kvk", "agriculture_department", "helpline"];
const COLUMNS = [
  "id",
  "name",
  "category",
  "state",
  "districts",
  "phoneNumbers",
  "email",
  "address",
  "sourceUrl",
  "verifiedOn",
];

function toRecord(cells: Record<string, string>): { id: string; errors: string[]; data: Record<string, unknown> } {
  const errors: string[] = [];
  const phoneNumbers = splitList(cells.phoneNumbers);

  for (const column of ["id", "name", "category", "state", "sourceUrl", "verifiedOn"]) {
    if (!cells[column]) errors.push(`missing ${column}`);
  }
  if (cells.id && !/^[a-z0-9-]+$/.test(cells.id)) errors.push("id may only use a-z, 0-9 and -");
  if (cells.category && !CATEGORIES.includes(cells.category)) errors.push(`unknown category "${cells.category}"`);
  // Some official lists give a lab's address but no number.
  if (phoneNumbers.length === 0 && !cells.address) errors.push("needs phoneNumbers or address");
  for (const phone of phoneNumbers) {
    if (!/^\+?[0-9 -]{3,}$/.test(phone)) errors.push(`bad phone number "${phone}"`);
  }
  if (cells.verifiedOn && !/^\d{4}-\d{2}-\d{2}$/.test(cells.verifiedOn)) errors.push("verifiedOn must be YYYY-MM-DD");
  if (cells.sourceUrl && !/^https?:\/\//.test(cells.sourceUrl)) errors.push("sourceUrl must start with http");

  return {
    id: cells.id,
    errors,
    data: {
      name: cells.name,
      category: cells.category,
      stateKey: cells.state.toLowerCase(),
      districts: splitList(cells.districts),
      phoneNumbers,
      email: cells.email || null,
      address: cells.address || null,
      sourceUrl: cells.sourceUrl,
      verifiedOn: cells.verifiedOn,
    },
  };
}

function readRecords(file: string) {
  const records = readCsvRows(file, COLUMNS).map(toRecord);

  const problems: string[] = [];
  const seen = new Set<string>();
  records.forEach((record, i) => {
    // +2: the header is line 1, and lines count from 1.
    const line = `line ${i + 2}`;
    record.errors.forEach((error) => problems.push(`${line}: ${error}`));
    if (seen.has(record.id)) problems.push(`${line}: duplicate id "${record.id}"`);
    seen.add(record.id);
  });
  if (problems.length > 0) throw new Error(`Fix these and try again:\n${problems.join("\n")}`);
  return records;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Usage: importPublicContacts.ts <file.csv> [--write] [--delete-missing]");

  const write = args.includes("--write");
  const deleteMissing = args.includes("--delete-missing");

  const records = readRecords(file);
  console.log(`${records.length} valid records in ${file}`);
  if (!write) {
    console.log("Checked only. Pass --write to load them.");
    return;
  }

  const db = initFirestore();
  const writer = db.bulkWriter();
  for (const record of records) {
    writer.set(db.collection(COLLECTION).doc(record.id), record.data);
  }

  if (deleteMissing) {
    const ids = new Set(records.map((record) => record.id));
    const existing = await db.collection(COLLECTION).listDocuments();
    const stale = existing.filter((doc) => !ids.has(doc.id));
    stale.forEach((doc) => writer.delete(doc));
    console.log(`Deleting ${stale.length} records not in the file`);
  }

  await writer.close();
  console.log(`Loaded ${records.length} records into ${COLLECTION}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
