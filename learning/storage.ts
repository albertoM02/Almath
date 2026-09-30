import { emptyProgress, isProgressState } from "./progress";
import type { ProgressState } from "./types";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("almath-progress", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("progress");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Close another Almath tab and try again."));
    });
    databasePromise.catch(() => {
      databasePromise = undefined;
    });
  }
  return databasePromise;
}

export async function loadProgress(): Promise<ProgressState> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("progress", "readonly")
      .objectStore("progress")
      .get("current");
    request.onsuccess = () => {
      if (request.result === undefined) resolve(emptyProgress());
      else if (isProgressState(request.result)) resolve(request.result);
      else reject(new Error("Saved progress has an unsupported format."));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveProgress(progress: ProgressState): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("progress", "readwrite");
    transaction.objectStore("progress").put(progress, "current");
    // A successful request is not enough: the transaction must have committed.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
