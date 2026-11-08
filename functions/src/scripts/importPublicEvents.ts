/**
 * Loads a spreadsheet of farming events (Krishi Melas, trainings, scheme
 * camps...) into `public_events`. The app lists upcoming ones to farms in the
 * area, under Tasks > Alerts; past events drop off on their own.
 *
 * Only checks the file and prints a summary unless --write is passed:
 *   npx ts-node src/scripts/importPublicEvents.ts <file.csv> [--write] [--delete-missing]
 *
 * --delete-missing also removes events whose id isn't in the file, so use it
 * only with the complete list.
 *
 * Columns: id, title, titleKn, titleHi, description, descriptionKn,
 * descriptionHi, startDate and endDate (YYYY-MM-DD), venue, organizer, link,
 * state (or ALL for national), districts (several separated by |; none means
 * the whole state). Only id, title, startDate, endDate, venue and state are
 * required. Other columns, such as notes, aren't loaded.
 */
import { initFirestore, readCsvRows, splitList } from "./csvImport";

const COLLECTION = "public_events";
const COLUMNS = [
  "id",
  "title",
  "titleKn",
  "titleHi",
  "description",
  "descriptionKn",
  "descriptionHi",
  "startDate",
  "endDate",
  "venue",
  "organizer",
  "link",
  "state",
  "districts",
] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Language code to text, leaving out blank translations. */
function texts(en: string, kn: string, hi: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ en, kn, hi }).filter(([, text]) => text.length > 0),
  );
}

export function toEvent(cells: Record<string, string>): {
  id: string;
  errors: string[];
  data: Record<string, unknown>;
} {
  const errors: string[] = [];
  for (const column of ["id", "title", "startDate", "endDate", "venue", "state"]) {
    if (!cells[column]) errors.push(`missing ${column}`);
  }
  if (cells.id && !/^[a-z0-9-]+$/.test(cells.id)) errors.push("id may only use a-z, 0-9 and -");
  for (const column of ["startDate", "endDate"]) {
    if (cells[column] && !DATE.test(cells[column])) errors.push(`${column} must be YYYY-MM-DD`);
  }
  if (DATE.test(cells.startDate ?? "") && DATE.test(cells.endDate ?? "") && cells.endDate < cells.startDate) {
    errors.push("endDate is before startDate");
  }
  if (cells.link && !/^https?:\/\//.test(cells.link)) errors.push("link must start with http");

  return {
    id: cells.id,
    errors,
    data: {
      title: texts(cells.title, cells.titleKn, cells.titleHi),
      description: texts(cells.description, cells.descriptionKn, cells.descriptionHi),
      startDate: cells.startDate,
      endDate: cells.endDate,
      venue: cells.venue,
      organizer: cells.organizer || null,
      link: cells.link || null,
      // Matched the way the app matches public contacts.
      stateKey: cells.state.toLowerCase(),
      districts: splitList(cells.districts),
    },
  };
}

function readEvents(file: string) {
  const events = readCsvRows(file, COLUMNS).map(toEvent);
  const problems: string[] = [];
  const seen = new Set<string>();
  events.forEach((event, i) => {
    // +2: the header is line 1, and lines count from 1.
    const line = `line ${i + 2}`;
    event.errors.forEach((error) => problems.push(`${line}: ${error}`));
    if (seen.has(event.id)) problems.push(`${line}: duplicate id "${event.id}"`);
    seen.add(event.id);
  });
  if (problems.length > 0) throw new Error(`Fix these and try again:\n${problems.join("\n")}`);
  return events;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Usage: importPublicEvents.ts <file.csv> [--write] [--delete-missing]");

  const events = readEvents(file);
  console.log(`${events.length} valid events in ${file}`);
  if (!args.includes("--write")) {
    console.log("Checked only. Pass --write to load them.");
    return;
  }

  const db = initFirestore();
  const writer = db.bulkWriter();
  for (const event of events) {
    writer.set(db.collection(COLLECTION).doc(event.id), event.data);
  }
  if (args.includes("--delete-missing")) {
    const ids = new Set(events.map((event) => event.id));
    const stale = (await db.collection(COLLECTION).listDocuments()).filter((doc) => !ids.has(doc.id));
    stale.forEach((doc) => writer.delete(doc));
    console.log(`Deleting ${stale.length} events not in the file`);
  }
  await writer.close();
  console.log(`Loaded ${events.length} events into ${COLLECTION}`);
}

// Only when run as a script, so tests can import toEvent.
if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
