import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Cloud Functions run with an implicit service account, so no credentials
// need to be supplied here - initializeApp() picks them up automatically.
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
