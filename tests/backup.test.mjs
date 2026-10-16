import assert from "node:assert/strict";
import test from "node:test";
import { pbkdf2Sync, createCipheriv, randomBytes } from "node:crypto";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { bundle } from "./helpers.mjs";

const {
  emptyProgress,
  encryptProgress,
  decryptProgress,
  mergeProgress,
  isProgressState,
  BackupError,
  MAX_BACKUP_BYTES,
} = bundle(`
  export * from './learning/backup';
  export * from './learning/progress';
`);
const PASSWORD = "a private backup passphrase";
const completion = (result = "solved", day = "2026-10-15") => ({
  result,
  completedAt: `${day}T12:00:00Z`,
});
const attempt = {
  exerciseId: "saved",
  version: 1,
  answer: "private answer 1729",
  correct: true,
  hintUsed: true,
  at: "2026-10-15T12:00:00Z",
};
function saved() {
  return {
    ...emptyProgress(),
    completed: { saved: completion() },
    attempts: [attempt],
    streak: { days: ["2026-10-15"] },
  };
}
function externalBackup(payload) {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const key = pbkdf2Sync(PASSWORD, salt, 600_000, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("almath-progress-backup:1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return JSON.stringify({
    format: "almath-progress-backup",
    version: 1,
    cipher: "AES-256-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: 600_000,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

test("Encrypted backups preserve all progress and use fresh randomness without leaking answers", async () => {
  const original = saved();
  const first = await encryptProgress(original, PASSWORD);
  const second = await encryptProgress(original, PASSWORD);
  assert.notEqual(first, second);
  assert.ok(!first.includes(attempt.answer));
  assert.ok(!first.includes('"completed"'));
  assert.deepEqual(await decryptProgress(first, PASSWORD), original);
  assert.deepEqual(await decryptProgress(second, PASSWORD), original);
  assert.deepEqual(
    original,
    saved(),
    "Export does not mutate the current save",
  );
});

test("Backups interoperate with independent Node cryptography and accept legacy saves", async () => {
  const original = saved();
  delete original.streak;
  const external = externalBackup({
    app: "Almath",
    exportedAt: "2026-10-16T12:00:00Z",
    progress: original,
  });
  assert.deepEqual(await decryptProgress(external, PASSWORD), original);
  assert.equal(
    isProgressState(await decryptProgress(external, PASSWORD)),
    true,
  );
});

test("Incorrect passwords, tampering and unsupported encryption settings are rejected", async () => {
  const encrypted = await encryptProgress(saved(), PASSWORD);
  await assert.rejects(
    decryptProgress(encrypted, "a different long password"),
    (e) => e instanceof BackupError && e.code === "invalid",
  );
  const envelope = JSON.parse(encrypted);
  const bytes = Buffer.from(envelope.data, "base64");
  bytes[0] ^= 1;
  for (const changes of [
    { data: bytes.toString("base64") },
    { version: 2 },
    { iterations: 1_000_000_000 },
    { iv: "AAAA" },
    { cipher: "AES-CBC" },
    { salt: "!not-base64!" },
  ])
    await assert.rejects(
      decryptProgress(JSON.stringify({ ...envelope, ...changes }), PASSWORD),
    );
  await assert.rejects(
    encryptProgress(saved(), "too short"),
    (e) => e.code === "password",
  );
  await assert.rejects(
    decryptProgress("x".repeat(MAX_BACKUP_BYTES + 1), PASSWORD),
    (e) => e.code === "size",
  );
});

test("Authenticated but invalid progress and prototype keys cannot be imported", async () => {
  for (const progress of [
    { ...emptyProgress(), attempts: [null] },
    { ...emptyProgress(), streak: { days: ["2026-02-30"] } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ]) {
    await assert.rejects(
      decryptProgress(
        externalBackup({
          app: "Almath",
          exportedAt: "2026-10-16T12:00:00Z",
          progress,
        }),
        PASSWORD,
      ),
    );
  }
  assert.equal({}.polluted, undefined);
});

test("Importing an older backup is additive, idempotent and keeps current settings", () => {
  const current = saved();
  current.dailyGoal = {
    target: 10,
    reminderEnabled: true,
    reminderTime: "18:00",
  };
  current.completed.newer = completion("solved", "2026-10-16");
  current.completed.reviewed = completion("reviewed");
  current.reviewCounts.module = 4;
  const imported = saved();
  imported.completed.reviewed = completion("solved");
  imported.completed.older = completion("solved", "2026-10-14");
  imported.reviewCounts.module = 2;
  imported.dailyGoal = {
    target: 3,
    reminderEnabled: false,
    reminderTime: "12:00",
  };
  imported.streak.days.push("2026-10-14");
  const before = structuredClone(current);
  const merged = mergeProgress(current, imported);
  assert.deepEqual(current, before);
  assert.equal(Object.keys(merged.completed).length, 4);
  assert.equal(merged.completed.reviewed.result, "solved");
  assert.equal(merged.reviewCounts.module, 4);
  assert.equal(merged.attempts.length, 1);
  assert.deepEqual(merged.streak.days, ["2026-10-14", "2026-10-15"]);
  assert.deepEqual(merged.dailyGoal, current.dailyGoal);
  assert.deepEqual(mergeProgress(merged, imported), merged);
  assert.equal(isProgressState(merged), true);
});

test("Restoring on a fresh installation keeps goals but does not opt into reminders", () => {
  const imported = saved();
  imported.dailyGoal = {
    target: 7,
    reminderEnabled: true,
    reminderTime: "16:00",
  };
  const merged = mergeProgress(emptyProgress(), imported);
  assert.deepEqual(merged.dailyGoal, {
    ...imported.dailyGoal,
    reminderEnabled: false,
  });
});

async function database(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open("almath-progress", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("progress");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function put(factory, value) {
  const db = await database(factory);
  await new Promise((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(value, "current");
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
  db.close();
}
async function get(factory, key = "current") {
  const db = await database(factory);
  const result = await new Promise((resolve, reject) => {
    const request = db.transaction("progress").objectStore("progress").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
  db.close();
  return result;
}
async function withDatabase(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const factory = new IDBFactory();
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    writable: true,
    value: factory,
  });
  try {
    await run(factory);
  } finally {
    if (previous) Object.defineProperty(globalThis, "indexedDB", previous);
    else delete globalThis.indexedDB;
  }
}

test("Restores commit a merged save and recovery snapshot atomically and survive reopening", async () => {
  await withDatabase(async (factory) => {
    const original = saved();
    await put(factory, original);
    const imported = {
      ...emptyProgress(),
      completed: { another: completion() },
    };
    const { restoreProgressBackup, loadProgress } = bundle(
      'export * from "./learning/storage";',
    );
    const restored = await restoreProgressBackup(imported);
    assert.equal(Object.keys(restored.completed).length, 2);
    assert.deepEqual(await get(factory, "before-restore"), original);
    assert.deepEqual(await loadProgress(), restored);
    const reopened = bundle('export * from "./learning/storage";');
    assert.deepEqual(await reopened.loadProgress(), restored);
  });
});

test("A storage failure rolls back the whole restore; corrupt current saves are never overwritten", async () => {
  await withDatabase(async (factory) => {
    const original = saved();
    await put(factory, original);
    const { restoreProgressBackup } = bundle(
      'export * from "./learning/storage";',
    );
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "current")
        throw new globalThis.DOMException(
          "Simulated full storage",
          "QuotaExceededError",
        );
      return originalPut.call(this, value, key);
    };
    try {
      await assert.rejects(restoreProgressBackup(emptyProgress()));
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    assert.deepEqual(await get(factory), original);
    assert.equal(await get(factory, "before-restore"), undefined);
    const corrupt = { schemaVersion: 999, keep: "do not erase" };
    await put(factory, corrupt);
    await assert.rejects(restoreProgressBackup(emptyProgress()));
    assert.deepEqual(await get(factory), corrupt);
  });
});

test("Legacy USB export only reads existing progress, and a missing database stays empty", async () => {
  await withDatabase(async (factory) => {
    const { exportLegacyProgress, verifyLegacyBackup } = bundle(
      'export * from "./learning/legacy-export";',
    );
    await assert.rejects(exportLegacyProgress(PASSWORD));
    assert.deepEqual(await factory.databases(), []);
    const original = saved();
    await put(factory, original);
    const file = await exportLegacyProgress(PASSWORD);
    assert.deepEqual(await decryptProgress(file, PASSWORD), original);
    assert.deepEqual(await verifyLegacyBackup(file, PASSWORD), {
      completed: 1,
      days: 1,
    });
    assert.deepEqual(await get(factory), original);
    assert.equal(await get(factory, "before-restore"), undefined);
  });
});
