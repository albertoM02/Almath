import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.albertom02.almath",
  appName: "Almath",
  webDir: "out",
  backgroundColor: "#F7F3E7",
  // Keep this origin stable: IndexedDB belongs to it across APK updates.
  server: { hostname: "localhost", androidScheme: "https" },
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { insetsHandling: "css", style: "DARK" },
  },
};

export default config;
