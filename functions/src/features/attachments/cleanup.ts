/**
 * Which Storage files to delete after a record with attachments changed.
 *
 * The app stores a record's files as `attachments: [{storagePath, ...}]` and
 * only ever uploads; this decides what is no longer referenced:
 * - record deleted -> every file it had;
 * - list changed   -> files that were dropped from it;
 * - list missing after the write -> nothing (that writer didn't know about
 *   attachments, so it can't have meant to remove them).
 *
 * Only paths under the record's own farm folder are returned, so a record
 * can never be used to delete another farm's files.
 */
export function removedAttachmentPaths(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): string[] {
  if (!before) return [];
  const farmId = before.farmId;
  if (typeof farmId !== "string" || farmId.length === 0 || farmId.includes("/")) {
    return [];
  }
  if (after && !Array.isArray(after.attachments)) return [];

  const prefix = `farms/${farmId}/attachments/`;
  const keep = new Set(after ? pathsOf(after.attachments) : []);
  return pathsOf(before.attachments).filter(
    (p) => !keep.has(p) && p.startsWith(prefix) && !p.includes(".."),
  );
}

function pathsOf(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const paths = new Set<string>();
  for (const item of list) {
    const path = (item as { storagePath?: unknown } | null)?.storagePath;
    if (typeof path === "string" && path.length > 0) paths.add(path);
  }
  return [...paths];
}
