import { t } from "@/learning/content";
import { withBasePath } from "@/platform/base-path";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label={t("brandLabel")}
    >
      {/* This mark comes from the approved brand artwork. */}
      <img src={withBasePath("/logo.png")} alt="" width="58" height="58" />
      <span className="wordmark">
        <strong>Alma</strong>
        <span>th</span>
      </span>
    </span>
  );
}
