import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ModuleEntry } from "@/components/almath/module-entry";
import { getOutline, locale, t } from "@/learning/content";
import type { CoursePart, ProgressState } from "@/learning/types";

type UnitsScreenProps = {
  courseId: string;
  activeModuleId?: string;
  progress: ProgressState;
  start: (id: string, mode: "learn" | "review", index?: number) => void;
};

function UnitModules({
  moduleIds,
  activeModuleId,
  progress,
  start,
}: {
  moduleIds: string[];
  activeModuleId?: string;
  progress: ProgressState;
  start: UnitsScreenProps["start"];
}) {
  const [showAll, setShowAll] = useState(
    moduleIds.indexOf(activeModuleId ?? "") >= 3,
  );
  const visible = showAll ? moduleIds : moduleIds.slice(0, 3);
  return (
    <div className="module-entries">
      {visible.map((moduleId) => (
        <ModuleEntry
          key={moduleId}
          moduleId={moduleId}
          progress={progress}
          start={start}
        />
      ))}
      {moduleIds.length > 3 && (
        <button
          className="text-button outline-more"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? t("showFewerModules")
            : t("showAllModules", { count: moduleIds.length })}
        </button>
      )}
    </div>
  );
}

function PartSection({
  part,
  progress,
  start,
  activeModuleId,
}: {
  part: CoursePart;
  progress: ProgressState;
  start: UnitsScreenProps["start"];
  activeModuleId?: string;
}) {
  const activeUnit = part.units.find((unit) =>
    unit.moduleIds.includes(activeModuleId ?? ""),
  );
  const [showAll, setShowAll] = useState(
    activeUnit ? part.units.indexOf(activeUnit) >= 3 : false,
  );
  const firstAvailable =
    activeUnit ?? part.units.find((unit) => unit.moduleIds.length > 0);
  const visibleUnits = showAll ? part.units : part.units.slice(0, 3);
  const first = part.units[0].number;
  const last = part.units[part.units.length - 1].number;

  return (
    <AccordionItem value={part.id} className="course-part">
      <AccordionTrigger className="part-trigger">
        <span className="part-badge" aria-hidden="true">
          {part.label}
        </span>
        <span className="outline-heading">
          <strong>{locale.parts[part.id].title}</strong>
          <small>
            {first === last
              ? t("unit", { number: first })
              : t("unitRange", { first, last })}
          </small>
        </span>
      </AccordionTrigger>
      <AccordionContent className="part-content">
        <Accordion
          type="multiple"
          defaultValue={firstAvailable ? [firstAvailable.id] : []}
        >
          {visibleUnits.map((unit) => (
            <AccordionItem
              key={unit.id}
              value={unit.id}
              className="course-unit"
            >
              <AccordionTrigger className="unit-trigger">
                <span className="unit-number" aria-hidden="true">
                  {String(unit.number).padStart(2, "0")}
                </span>
                <span className="outline-heading">
                  <strong>{locale.units[unit.id].title}</strong>
                  <small>
                    {unit.moduleIds.length > 0
                      ? t(
                          unit.moduleIds.length === 1
                            ? "availableModuleOne"
                            : "availableModuleMany",
                          { count: unit.moduleIds.length },
                        )
                      : t("plannedUnit")}
                  </small>
                </span>
              </AccordionTrigger>
              <AccordionContent className="unit-content">
                {locale.units[unit.id].description && (
                  <p className="small-note">
                    {locale.units[unit.id].description}
                  </p>
                )}
                {unit.moduleIds.length ? (
                  <UnitModules
                    moduleIds={unit.moduleIds}
                    activeModuleId={activeModuleId}
                    progress={progress}
                    start={start}
                  />
                ) : (
                  <p className="unit-empty">{t("modulesComingSoon")}</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {part.units.length > 3 && (
          <button
            className="text-button outline-more"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? t("showFewerUnits")
              : t("showRemainingUnits", { count: part.units.length - 3 })}
          </button>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function UnitsScreen({
  courseId,
  activeModuleId,
  progress,
  start,
}: UnitsScreenProps) {
  const outline = getOutline(courseId);
  const initialPart =
    outline.parts.find((part) =>
      part.units.some((unit) => unit.moduleIds.includes(activeModuleId ?? "")),
    ) ?? outline.parts[0];
  return (
    <div className="course-outline">
      <Accordion type="multiple" defaultValue={[initialPart.id]}>
        {outline.parts.map((part) => (
          <PartSection
            key={part.id}
            part={part}
            progress={progress}
            start={start}
            activeModuleId={activeModuleId}
          />
        ))}
      </Accordion>
      <p className="outline-note">{t("outlineNotice")}</p>
    </div>
  );
}
