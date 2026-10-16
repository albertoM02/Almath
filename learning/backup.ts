import { isProgressState } from "./progress";
import { practiceDays } from "./streak";
import type { Attempt, ProgressState } from "./types";

export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 8 * 1024 * 1024;
const ITERATIONS = 600_000;
const FORMAT = "almath-progress-backup";
const AAD = new TextEncoder().encode(`${FORMAT}:1`);

export class BackupError extends Error {
  constructor(public readonly code: "password" | "size" | "invalid") {
    super(`Progress backup: ${code}`);
  }
}

function passwordBytes(password: string) {
  if (password.length < 12 || password.length > 1024)
    throw new BackupError("password");
  return new TextEncoder().encode(password);
}

function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(chunks.join(""));
}

function unbase64(value: unknown): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    value.length > MAX_BACKUP_BYTES ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new BackupError("invalid");
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function encryptionKey(
  password: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    password,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function parse(text: string) {
  return JSON.parse(text, (key, value: unknown) => {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new BackupError("invalid");
    return value;
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function encryptProgress(
  progress: ProgressState,
  password: string,
): Promise<string> {
  const secret = passwordBytes(password);
  if (!isProgressState(progress)) throw new BackupError("invalid");
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      app: "Almath",
      exportedAt: new Date().toISOString(),
      progress,
    }),
  );
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new BackupError("size");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const key = await encryptionKey(secret, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
      key,
      plaintext,
    );
    return JSON.stringify({
      format: FORMAT,
      version: 1,
      cipher: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations: ITERATIONS,
      salt: base64(salt),
      iv: base64(iv),
      data: base64(new Uint8Array(ciphertext)),
    });
  } finally {
    secret.fill(0);
    plaintext.fill(0);
  }
}

export async function decryptProgress(
  text: string,
  password: string,
): Promise<ProgressState> {
  const secret = passwordBytes(password);
  let plaintext: Uint8Array | undefined;
  try {
    if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
      throw new BackupError("size");
    const envelope: unknown = parse(text);
    if (
      !record(envelope) ||
      envelope.format !== FORMAT ||
      envelope.version !== 1 ||
      envelope.cipher !== "AES-256-GCM" ||
      envelope.kdf !== "PBKDF2-SHA-256" ||
      envelope.iterations !== ITERATIONS
    )
      throw new BackupError("invalid");
    const salt = unbase64(envelope.salt);
    const iv = unbase64(envelope.iv);
    const data = unbase64(envelope.data);
    if (
      salt.length !== 16 ||
      iv.length !== 12 ||
      data.length < 16 ||
      data.length > MAX_PLAINTEXT_BYTES + 16
    )
      throw new BackupError("invalid");
    const key = await encryptionKey(secret, salt);
    plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
        key,
        data,
      ),
    );
    const payload: unknown = parse(
      new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
    );
    if (
      !record(payload) ||
      payload.app !== "Almath" ||
      typeof payload.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(payload.exportedAt)) ||
      !isProgressState(payload.progress)
    )
      throw new BackupError("invalid");
    return payload.progress;
  } catch (error) {
    if (error instanceof BackupError) throw error;
    // Do not expose decrypted content or distinguish an incorrect password
    // from a damaged authentication tag.
    throw new BackupError("invalid");
  } finally {
    secret.fill(0);
    plaintext?.fill(0);
  }
}

function attemptKey(attempt: Attempt) {
  return JSON.stringify([
    attempt.exerciseId,
    attempt.version,
    attempt.answer,
    attempt.correct,
    attempt.hintUsed,
    new Date(attempt.at).toISOString(),
  ]);
}

export function mergeProgress(
  current: ProgressState,
  imported: ProgressState,
): ProgressState {
  if (!isProgressState(current) || !isProgressState(imported))
    throw new BackupError("invalid");
  const completed = { ...current.completed };
  for (const [id, incoming] of Object.entries(imported.completed)) {
    const saved = Object.hasOwn(completed, id) ? completed[id] : undefined;
    if (
      !saved ||
      (saved.result !== "solved" && incoming.result === "solved") ||
      (saved.result === incoming.result &&
        Date.parse(incoming.completedAt) < Date.parse(saved.completedAt))
    )
      completed[id] = incoming;
  }
  const attempts = new Map(
    current.attempts.map((item) => [attemptKey(item), item]),
  );
  for (const item of imported.attempts)
    if (!attempts.has(attemptKey(item))) attempts.set(attemptKey(item), item);
  const reviewCounts = { ...current.reviewCounts };
  for (const [id, count] of Object.entries(imported.reviewCounts))
    reviewCounts[id] = Math.max(
      Object.hasOwn(reviewCounts, id) ? reviewCounts[id] : 0,
      count,
    );
  const preferences =
    current.dailyGoal ??
    (imported.dailyGoal && {
      ...imported.dailyGoal,
      // Restoring a file on another device must not opt into notifications.
      reminderEnabled: false,
    });
  return {
    ...current,
    sessions: { ...imported.sessions, ...current.sessions },
    completed,
    attempts: [...attempts.values()].sort(
      (a, b) => Date.parse(a.at) - Date.parse(b.at),
    ),
    reviewCounts,
    ...(preferences ? { dailyGoal: preferences } : {}),
    streak: {
      days: [
        ...new Set([...practiceDays(current), ...practiceDays(imported)]),
      ].sort(),
    },
    view: { screen: "courses" },
  };
}
