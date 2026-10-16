import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  Info,
  LoaderCircle,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { Brand } from "./brand";
import { t } from "@/learning/content";
import type { View } from "@/learning/types";

export type SaveStatus = "saved" | "saving" | "error";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const Icon =
    status === "saved"
      ? Check
      : status === "saving"
        ? LoaderCircle
        : AlertCircle;
  return (
    <span
      className={`save-status ${status}`}
      title={t(status === "error" ? "saveError" : status)}
      aria-live="polite"
    >
      <Icon size={15} aria-hidden="true" />
      <span>{t(status === "error" ? "saveWarningTitle" : status)}</span>
    </span>
  );
}

export function HomeHeader({
  title,
  subtitle,
  onAbout,
  onBack,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  onAbout: () => void;
  onBack?: () => void;
  compact?: boolean;
}) {
  return (
    <header
      className={`home-header ${onBack ? "units-header" : ""} ${compact ? "compact-home-header" : ""}`}
    >
      <div className="header-inner">
        <div className="brand-row">
          {onBack && (
            <button className="text-button light" onClick={onBack}>
              <ChevronLeft size={20} aria-hidden="true" />
              {t("courseBack")}
            </button>
          )}
          <Brand />
          <button
            className="icon-button light"
            aria-label={t("about")}
            onClick={onAbout}
          >
            <Info size={23} />
          </button>
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  );
}

export function BackButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button back-button" onClick={onClick}>
      <ChevronLeft size={20} aria-hidden="true" />
      {children}
    </button>
  );
}

export function BottomNavigation({
  view,
  navigate,
}: {
  view: View;
  navigate: (view: View) => void;
}) {
  const review = view.screen === "review";
  return (
    <nav className="bottom-navigation" aria-label={t("mainNavigation")}>
      <button
        onClick={() => navigate({ screen: "courses" })}
        aria-current={!review ? "page" : undefined}
      >
        <BookOpen size={24} />
        <span>{t("learn")}</span>
      </button>
      <button
        onClick={() => navigate({ screen: "review" })}
        aria-current={review ? "page" : undefined}
      >
        <ChartNoAxesColumnIncreasing size={24} />
        <span>{t("review")}</span>
      </button>
    </nav>
  );
}
