import { execFileSync } from "node:child_process";
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const PACKAGE = "io.github.albertom02.almath";
const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log(
    "Keep the old Almath app installed and open. Connect your own phone by USB and authorize USB debugging on a trusted computer. Run: node scripts/export-legacy-progress.mjs [--serial DEVICE] [--output FILE.almathbackup]. Then verify locally with: node scripts/export-legacy-progress.mjs --verify FILE.almathbackup. Hidden password prompts protect the local export. No app data is changed or uploaded. Export works only when the installed APK exposes WebView debugging. Disable USB debugging after the export.",
  );
  process.exit(0);
}
const options = {};
for (let i = 0; i < argv.length; i += 2) {
  if (!["--serial", "--output", "--verify"].includes(argv[i]) || !argv[i + 1])
    throw new Error("Use --help for supported arguments.");
  options[argv[i]] = argv[i + 1];
}
function execute(args) {
  return execFileSync("adb", args, {
    encoding: "utf8",
    timeout: 15_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function secretPrompt(label) {
  if (!process.stdin.isTTY)
    throw new Error("Run this tool directly in an interactive terminal.");
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (data) => {
      for (const character of data.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Export cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

let adbPrefix;
let port;
let socket;
try {
  let source;
  try {
    source = await readFile(
      new URL("./legacy-export.bundle.js", import.meta.url),
      "utf8",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const { buildSync } = await import("esbuild");
    source = buildSync({
      entryPoints: [
        fileURLToPath(new URL("../learning/legacy-export.ts", import.meta.url)),
      ],
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: "AlmathLegacy",
      write: false,
    }).outputFiles[0].text;
  }
  if (options["--verify"]) {
    const file = options["--verify"];
    if ((await stat(file)).size > 12 * 1024 * 1024)
      throw new Error("Backup file is too large.");
    const password = await secretPrompt("Backup password (hidden): ");
    const summary = await runInNewContext(
      `${source}\nAlmathLegacy.verifyLegacyBackup(backupText, password)`,
      {
        crypto: globalThis.crypto,
        TextEncoder: globalThis.TextEncoder,
        TextDecoder: globalThis.TextDecoder,
        atob: globalThis.atob,
        btoa: globalThis.btoa,
        backupText: await readFile(file, "utf8"),
        password,
      },
    );
    console.log(
      `Backup verified: ${summary.completed} completed exercises and ${summary.days} recorded practice days. Keep the file and password safe.`,
    );
    process.exit(0);
  }
  const devices = execute(["devices"])
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => /\sdevice$/.test(line))
    .map((line) => line.split(/\s/)[0]);
  const serial =
    options["--serial"] || (devices.length === 1 ? devices[0] : undefined);
  if (!serial || !devices.includes(serial))
    throw new Error(
      "Connect and authorize one device, or select it explicitly with --serial. Keep the old Almath installation.",
    );
  adbPrefix = ["-s", serial];
  const pid = execute([...adbPrefix, "shell", "pidof", PACKAGE]);
  if (!/^\d+$/.test(pid))
    throw new Error("Open the old Almath app on the phone, then try again.");
  port = execute([
    ...adbPrefix,
    "forward",
    "tcp:0",
    `localabstract:webview_devtools_remote_${pid}`,
  ]);
  if (!/^\d+$/.test(port))
    throw new Error("A local USB connection could not be established.");
  const response = await globalThis.fetch(
    `http://127.0.0.1:${port}/json/list`,
    {
      signal: globalThis.AbortSignal.timeout(10_000),
    },
  );
  const targets = await response.json();
  const target = targets.find((item) => {
    try {
      return (
        item.type === "page" && new URL(item.url).origin === "https://localhost"
      );
    } catch {
      return false;
    }
  });
  if (!target)
    throw new Error(
      "No debuggable Almath page was found. Keep the old app installed.",
    );
  const debuggerUrl = new URL(target.webSocketDebuggerUrl);
  if (
    debuggerUrl.protocol !== "ws:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(debuggerUrl.hostname) ||
    debuggerUrl.port !== port
  )
    throw new Error("Unexpected debugging endpoint. Export stopped.");
  const password = await secretPrompt(
    "Backup password (12+ characters, hidden): ",
  );
  if (password.length < 12 || password.length > 1024)
    throw new Error("The backup password must contain 12 to 1,024 characters.");
  if (password !== (await secretPrompt("Confirm password (hidden): ")))
    throw new Error("Passwords do not match.");
  socket = new globalThis.WebSocket(debuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("The USB debugging connection failed.")),
      { once: true },
    );
  });
  const encrypted = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error("The encrypted export timed out. Nothing was changed."),
        ),
      60_000,
    );
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        reject(
          new Error("The USB connection closed before the export completed."),
        );
      },
      { once: true },
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      const value = message.result?.result?.value;
      if (
        message.error ||
        message.result?.exceptionDetails ||
        typeof value !== "string"
      )
        reject(
          new Error(
            "The old progress could not be exported. Nothing was changed; keep the old app installed.",
          ),
        );
      else resolve(value);
    });
    socket.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: `(async () => { ${source}\n return AlmathLegacy.exportLegacyProgress(${JSON.stringify(password)}); })()`,
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    );
  });
  const envelope = JSON.parse(encrypted);
  if (
    Buffer.byteLength(encrypted) > 12 * 1024 * 1024 ||
    envelope.format !== "almath-progress-backup" ||
    envelope.version !== 1
  )
    throw new Error(
      "The exported file has an unexpected format. Nothing was changed.",
    );
  const output =
    options["--output"] ||
    `Almath-progress-${new Date().toISOString().slice(0, 10)}.almathbackup`;
  await writeFile(output, encrypted, { flag: "wx", mode: 0o600 });
  if ((await readFile(output, "utf8")) !== encrypted)
    throw new Error("Saved backup verification failed.");
  console.log(
    `Encrypted progress saved to ${output}. The old app and its data are unchanged. Keep the file and password safe. Verify the backup before uninstalling anything.`,
  );
} catch {
  console.error(
    "Export could not finish. Keep the old app installed. Check Node.js 22.13+, adb, USB authorization, that Almath is open, and that the installed APK exposes WebView debugging. Use --help for details.",
  );
  process.exitCode = 1;
} finally {
  socket?.close();
  if (port && adbPrefix) {
    try {
      execute([...adbPrefix, "forward", "--remove", `tcp:${port}`]);
    } catch {
      /* The device may have disconnected. */
    }
  }
}
