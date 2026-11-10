import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { removedAttachmentPaths } from "./cleanup";

// Deletes bill / receipt / soil card files from Storage once no record points
// at them: when one is removed in the app, or its record is deleted (by hand,
// by a labour payment being undone, or a batch delete). Rare and not
// user-facing, so no warm instance.
function cleanupTrigger(collection: string) {
  return onDocumentWritten(
    { document: `${collection}/{docId}`, region: "asia-south1", minInstances: 0 },
    async (event) => {
      const paths = removedAttachmentPaths(
        event.data?.before.data(),
        event.data?.after.data(),
      );
      if (paths.length === 0) return;

      const bucket = getStorage().bucket();
      await Promise.all(
        paths.map((path) =>
          bucket
            .file(path)
            .delete({ ignoreNotFound: true })
            .catch((err: unknown) =>
              logger.warn("Attachment delete failed", { path, err: String(err) }),
            ),
        ),
      );
      logger.info("Deleted removed attachments", {
        collection,
        docId: event.params.docId,
        count: paths.length,
      });
    },
  );
}

export const cleanupExpenseAttachments = cleanupTrigger("expenses");
export const cleanupIncomeAttachments = cleanupTrigger("income");
export const cleanupBudgetAttachments = cleanupTrigger("budgets");
export const cleanupSoilTestAttachments = cleanupTrigger("soil_tests");
