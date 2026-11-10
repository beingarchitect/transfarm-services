import assert from "node:assert/strict";
import { test } from "node:test";
import { removedAttachmentPaths } from "./cleanup";

const a = { storagePath: "farms/f1/attachments/finance/a.jpg" };
const b = { storagePath: "farms/f1/attachments/finance/b.pdf" };

test("deleting a record removes all its files", () => {
  assert.deepEqual(
    removedAttachmentPaths({ farmId: "f1", attachments: [a, b] }, undefined),
    [a.storagePath, b.storagePath],
  );
});

test("an edit removes only the files dropped from the list", () => {
  assert.deepEqual(
    removedAttachmentPaths(
      { farmId: "f1", attachments: [a, b] },
      { farmId: "f1", attachments: [b] },
    ),
    [a.storagePath],
  );
});

test("a write that doesn't know about attachments removes nothing", () => {
  assert.deepEqual(
    removedAttachmentPaths({ farmId: "f1", attachments: [a] }, { farmId: "f1", amount: 5 }),
    [],
  );
});

test("new records and records without files are a no-op", () => {
  assert.deepEqual(removedAttachmentPaths(undefined, { farmId: "f1", attachments: [a] }), []);
  assert.deepEqual(removedAttachmentPaths({ farmId: "f1" }, undefined), []);
});

test("never deletes outside the record's own farm folder", () => {
  const otherFarm = { storagePath: "farms/f2/attachments/finance/x.jpg" };
  const sneaky = { storagePath: "farms/f1/attachments/../files/y.jpg" };
  const notAttachment = { storagePath: "farms/f1/files/z.jpg" };
  assert.deepEqual(
    removedAttachmentPaths(
      { farmId: "f1", attachments: [otherFarm, sneaky, notAttachment, a] },
      undefined,
    ),
    [a.storagePath],
  );
  assert.deepEqual(
    removedAttachmentPaths({ farmId: "f1/../f2", attachments: [otherFarm] }, undefined),
    [],
  );
});
