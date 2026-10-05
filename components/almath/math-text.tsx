import { renderToString } from "katex";
import { memo } from "react";

const expressions = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;

export const MathText = memo(function MathText({
  children,
}: {
  children: string;
}) {
  return children.split(expressions).map((part, index) => {
    if (!part.startsWith("\\(") && !part.startsWith("\\[")) return part;

    const displayMode = part.startsWith("\\[");
    // Only KaTeX generates HTML; React escapes the surrounding text.
    const html = renderToString(part.slice(2, -2), {
      displayMode,
      output: "htmlAndMathml",
      throwOnError: false,
      trust: false,
    });

    return (
      <span
        key={index}
        className={displayMode ? "math-display" : "math-inline"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  });
});
