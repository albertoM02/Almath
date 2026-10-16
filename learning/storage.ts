import { emptyProgress, isProgressState } from "./progress";
import type { ProgressState } from "./types";
import { mergeProgress } from "./backup";

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
  if (!isProgressState(progress))
    throw new Error("Progress was not saved because its format is invalid.");
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

export async function restoreProgressBackup(
  imported: ProgressState,
): Promise<ProgressState> {
  if (!isProgressState(imported))
    throw new Error("The backup has an unsupported progress format.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("progress", "readwrite");
    const store = transaction.objectStore("progress");
    const request = store.get("current");
    let merged: ProgressState;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        const current =
          request.result === undefined ? emptyProgress() : request.result;
        if (!isProgressState(current))
          throw new Error(
            "Existing progress could not be read. Nothing was changed.",
          );
        merged = mergeProgress(current, imported);
        if (!isProgressState(merged))
          throw new Error("Progress could not be merged. Nothing was changed.");
        // Both records commit together. A failed import cannot erase the save,
        // and the previous snapshot remains private inside the app database.
        store.put(current, "before-restore");
        store.put(merged, "current");
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(merged);
    transaction.onerror = () => reject(failure ?? transaction.error);
    transaction.onabort = () => reject(failure ?? transaction.error);
  });
}
