import { t } from "@/learning/content";

export function AboutScreen() {
  return (
    <article className="about-card">
      <span className="eyebrow">{t("version")}</span>
      <h2>{t("about")}</h2>
      <p>{t("aboutText")}</p>
      <h3>{t("saved")}</h3>
      <p>{t("storageDetail")}</p>
      <h3>{t("contentSources")}</h3>
      <p>{t("sourcesText")}</p>
      <p>{t("mlSourcesText")}</p>
      <ul className="source-links">
        <li>
          <a
            href="https://courses.csail.mit.edu/6.042/spring18/mcs.pdf"
            target="_blank"
            rel="noreferrer"
          >
            {t("sourceBook")}
          </a>
        </li>
        <li>
          <a
            href="https://creativecommons.org/licenses/by-sa/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            {t("sourceLicense")}
          </a>
        </li>
        <li>
          <a
            href="https://developers.google.com/machine-learning/crash-course/prereqs-and-prework"
            target="_blank"
            rel="noreferrer"
          >
            {t("sourceGoogle")}
          </a>
        </li>
      </ul>
      <a
        className="secondary-button"
        href="/Almath_Project_Guide.pdf"
        target="_blank"
        rel="noreferrer"
      >
        {t("projectGuide")}
      </a>
    </article>
  );
}
