import { encryptProgress, decryptProgress } from "./backup";
import { isProgressState } from "./progress";
import { practiceDays } from "./streak";
import type { ProgressState } from "./types";

/** Read-only rescue path for old, debuggable Almath APKs. */
export async function exportLegacyProgress(password: string) {
  const progress = await new Promise<ProgressState>((resolve, reject) => {
    const request = indexedDB.open("almath-progress", 1);
    request.onupgradeneeded = () => {
      // Never create a new save or change a database during rescue.
      request.transaction?.abort();
      reject(new Error("No existing Almath progress database was found."));
    };
    request.onerror = () =>
      reject(new Error("The existing progress database could not be opened."));
    request.onsuccess = () => {
      const database = request.result;
      try {
        const transaction = database.transaction("progress", "readonly");
        const read = transaction.objectStore("progress").get("current");
        read.onsuccess = () => {
          if (isProgressState(read.result)) resolve(read.result);
          else
            reject(
              new Error(
                "Existing progress has an unsupported format. Nothing was changed.",
              ),
            );
        };
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(new Error("Progress could not be read."));
        };
      } catch {
        database.close();
        reject(new Error("No readable Almath progress save was found."));
      }
    };
  });
  // Encryption happens on the phone. Only the encrypted file crosses USB.
  const encrypted = await encryptProgress(progress, password);
  const verified = await decryptProgress(encrypted, password);
  if (JSON.stringify(verified) !== JSON.stringify(progress))
    throw new Error("Backup verification failed. Nothing was changed.");
  return encrypted;
}

export async function verifyLegacyBackup(text: string, password: string) {
  const progress = await decryptProgress(text, password);
  return {
    completed: Object.keys(progress.completed).length,
    days: practiceDays(progress).length,
  };
}
