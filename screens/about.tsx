import { t } from "@/learning/content";
import {
  ProgressBackupSection,
  type BackupActions,
} from "@/components/almath/progress-backup";

export function AboutScreen({ backup }: { backup: BackupActions }) {
  return (
    <article className="about-card">
      <span className="eyebrow">{t("version")}</span>
      <h2>{t("about")}</h2>
      <p>{t("aboutText")}</p>
      <h3>{t("saved")}</h3>
      <p>{t("storageDetail")}</p>
      <ProgressBackupSection {...backup} />
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
      <h3>License</h3>
      <p>
        © 2026 Alberto Moro Carrera. Code: GPLv3 only. Original lessons and
        documentation: CC BY-SA 4.0. Third-party material retains its own
        licenses.
      </p>
      <p>
        You may redistribute and modify Almath under the applicable licenses.
        Almath is provided without warranty.
      </p>
      <details className="license-details">
        <summary>Open-source licenses</summary>
        <iframe
          className="license-frame"
          src="/legal/index.html"
          title="Almath licenses and third-party notices"
          sandbox=""
        />
      </details>
    </article>
  );
}
