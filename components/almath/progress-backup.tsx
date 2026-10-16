import { useEffect, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { t } from "@/learning/content";
import {
  BackupError,
  decryptProgress,
  encryptProgress,
  MAX_BACKUP_BYTES,
} from "@/learning/backup";
import { localDay } from "@/learning/daily-goal";
import { practiceDays } from "@/learning/streak";
import type { ProgressState } from "@/learning/types";
import {
  nativeBackupAvailable,
  saveBackupFile,
  selectBackupFile,
} from "@/platform/backup";

export type BackupActions = {
  read: () => Promise<ProgressState>;
  restore: (progress: ProgressState) => Promise<void>;
  registerDismiss: (handler: (() => boolean) | undefined) => void;
};

function errorMessage(error: unknown) {
  return t(
    error instanceof BackupError
      ? error.code === "password"
        ? "backupPasswordError"
        : error.code === "size"
          ? "backupSizeError"
          : "backupInvalidError"
      : "backupOperationError",
  );
}

export function ProgressBackupSection(actions: BackupActions) {
  const [mode, setMode] = useState<"export" | "import">();
  const [message, setMessage] = useState("");
  return (
    <section className="backup-section" aria-labelledby="backup-title">
      <h3 id="backup-title">{t("backupTitle")}</h3>
      <p>{t("backupDescription")}</p>
      <div className="backup-actions">
        <button
          className="secondary-button"
          onClick={() => {
            setMessage("");
            setMode("export");
          }}
        >
          <Download size={18} aria-hidden="true" /> {t("backupExport")}
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            setMessage("");
            setMode("import");
          }}
        >
          <Upload size={18} aria-hidden="true" /> {t("backupImport")}
        </button>
      </div>
      {message && (
        <p role="status" className="backup-status">
          {message}
        </p>
      )}
      {mode && (
        <BackupDialog
          {...actions}
          mode={mode}
          onClose={() => setMode(undefined)}
          onSuccess={(text) => {
            setMessage(text);
            setMode(undefined);
          }}
        />
      )}
    </section>
  );
}

function BackupDialog({
  mode,
  read,
  restore,
  registerDismiss,
  onClose,
  onSuccess,
}: BackupActions & {
  mode: "export" | "import";
  onClose: () => void;
  onSuccess: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [file, setFile] = useState<{ text: string; name: string }>();
  const [preview, setPreview] = useState<ProgressState>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    registerDismiss(() => {
      if (!busyRef.current) onCloseRef.current();
      return true;
    });
    return () => {
      registerDismiss(undefined);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [registerDismiss]);

  async function run(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPassword("");
      setConfirmation("");
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function chooseNative() {
    await run(async () => {
      const selected = await selectBackupFile();
      if (selected) {
        setFile(selected);
        setPreview(undefined);
      }
    });
  }

  async function chooseBrowser(selected: File | undefined) {
    if (!selected) return;
    await run(async () => {
      if (selected.size > MAX_BACKUP_BYTES) throw new BackupError("size");
      setFile({ text: await selected.text(), name: selected.name });
      setPreview(undefined);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "export" && password !== confirmation) {
      setError(t("backupPasswordMismatch"));
      return;
    }
    await run(async () => {
      if (mode === "export") {
        const snapshot = await read();
        const encrypted = await encryptProgress(snapshot, password);
        if (
          await saveBackupFile(
            encrypted,
            `Almath-progress-${localDay(new Date())}.almathbackup`,
          )
        )
          onSuccess(
            t(
              nativeBackupAvailable()
                ? "backupExported"
                : "backupDownloadStarted",
            ),
          );
      } else if (preview) {
        await restore(preview);
        onSuccess(t("backupImported"));
      } else {
        if (!file) throw new BackupError("invalid");
        setPreview(await decryptProgress(file.text, password));
      }
    });
  }

  return (
    // The explicit Close button and native Escape handler cover keyboard use.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className="daily-goal-dialog backup-dialog"
      aria-labelledby="backup-dialog-title"
      aria-describedby="backup-help"
      onCancel={(event) => {
        event.preventDefault();
        if (!busyRef.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busyRef.current) onClose();
      }}
    >
      <form className="backup-form" onSubmit={submit}>
        <div className="daily-goal-heading">
          <h2 id="backup-dialog-title">
            {t(mode === "export" ? "backupExport" : "backupImport")}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("backupClose")}
            disabled={busy}
            onClick={onClose}
          >
            <X size={23} aria-hidden="true" />
          </button>
        </div>
        <p className="small-note" id="backup-help">
          {t(mode === "export" ? "backupExportHelp" : "backupImportHelp")}
        </p>
        {mode === "import" && !preview && (
          <>
            <input
              ref={picker}
              type="file"
              hidden
              accept=".almathbackup,application/octet-stream,application/json"
              onChange={(event) => {
                void chooseBrowser(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="secondary-button backup-file-button"
              disabled={busy}
              onClick={() => {
                if (nativeBackupAvailable()) void chooseNative();
                else picker.current?.click();
              }}
            >
              {t("backupChooseFile")}
            </button>
            {file && <p className="small-note backup-filename">{file.name}</p>}
          </>
        )}
        {!preview && (
          <>
            <label className="backup-label" htmlFor="backup-password">
              {t("backupPassword")}
            </label>
            <input
              id="backup-password"
              type="password"
              autoComplete={
                mode === "export" ? "new-password" : "current-password"
              }
              autoCapitalize="none"
              spellCheck={false}
              minLength={12}
              maxLength={1024}
              required
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "export" && (
              <>
                <label className="backup-label" htmlFor="backup-confirmation">
                  {t("backupConfirmPassword")}
                </label>
                <input
                  id="backup-confirmation"
                  type="password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  minLength={12}
                  maxLength={1024}
                  required
                  disabled={busy}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            )}
            <p className="small-note">{t("backupPasswordHelp")}</p>
          </>
        )}
        {preview && (
          <div className="backup-preview">
            <p>
              {t("backupPreview", {
                completed: Object.keys(preview.completed).length,
                days: practiceDays(preview).length,
              })}
            </p>
            <p className="small-note">{t("backupMergeHelp")}</p>
          </div>
        )}
        {error && (
          <p className="daily-settings-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="primary-button"
          disabled={busy || (mode === "import" && !file)}
        >
          {t(
            busy
              ? "saving"
              : mode === "export"
                ? "backupSaveFile"
                : preview
                  ? "backupMerge"
                  : "backupPreviewAction",
          )}
        </button>
      </form>
    </dialog>
  );
}
