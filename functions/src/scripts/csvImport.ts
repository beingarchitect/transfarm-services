/**
 * Shared by the scripts that load a spreadsheet into Firestore
 * (importPublicContacts, importPublicEvents).
 */
import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export function splitList(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Each row of [file] as a map of column name to value, after checking every
 * one of [columns] is in the header. Spreadsheet apps may add a byte order
 * mark at the start, which is dropped.
 */
export function readCsvRows(file: string, columns: readonly string[]): Record<string, string>[] {
  const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const names = header?.map((h) => h.trim()) ?? [];
  const missing = columns.filter((column) => !names.includes(column));
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(", ")}`);
  return rows.map((row) => Object.fromEntries(names.map((name, i) => [name, (row[i] ?? "").trim()])));
}

export function initFirestore() {
  const possibleKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, "../../../../transfarm-app/scripts/serviceAccountKey.json"),
    path.resolve(__dirname, "../../serviceAccountKey.json"),
    path.resolve(process.cwd(), "serviceAccountKey.json"),
  ].filter((p): p is string => !!p && fs.existsSync(p));

  if (getApps().length === 0) {
    if (possibleKeyPaths.length > 0) {
      initializeApp({ credential: cert(possibleKeyPaths[0]) });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}
