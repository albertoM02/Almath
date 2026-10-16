import { Capacitor, registerPlugin } from "@capacitor/core";
import { BackupError, MAX_BACKUP_BYTES } from "@/learning/backup";

interface ProgressBackupPlugin {
  saveFile(options: {
    data: string;
    filename: string;
  }): Promise<{ cancelled?: boolean }>;
  selectFile(): Promise<{ cancelled?: boolean; data?: string; name?: string }>;
}

const ProgressBackup = registerPlugin<ProgressBackupPlugin>("ProgressBackup");

export function nativeBackupAvailable() {
  return Capacitor.getPlatform() === "android";
}

export async function saveBackupFile(
  data: string,
  filename: string,
): Promise<boolean> {
  if (new TextEncoder().encode(data).length > MAX_BACKUP_BYTES)
    throw new BackupError("size");
  if (nativeBackupAvailable())
    return !(await ProgressBackup.saveFile({ data, filename })).cancelled;
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

export async function selectBackupFile() {
  const file = await ProgressBackup.selectFile();
  if (file.cancelled) return undefined;
  if (typeof file.data !== "string") throw new BackupError("invalid");
  if (new TextEncoder().encode(file.data).length > MAX_BACKUP_BYTES)
    throw new BackupError("size");
  return { text: file.data, name: file.name || "Almath backup" };
}
