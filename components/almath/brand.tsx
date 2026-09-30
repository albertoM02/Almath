import { t } from "@/learning/content";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label={t("brandLabel")}
    >
      {/* This mark comes from the approved brand artwork. */}
      <img src="/logo.png" alt="" width="58" height="58" />
      <span className="wordmark">
        <strong>Alma</strong>
        <span>th</span>
      </span>
    </span>
  );
}
