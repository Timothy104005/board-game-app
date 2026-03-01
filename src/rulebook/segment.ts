import { normalizeRulebookText } from "./normalize.js";
import type { RulebookSection, RulebookSegments } from "./types.js";

export function segmentRulebook(text: string): RulebookSegments {
  const normalized = normalizeRulebookText(text);
  const lines = normalized.length === 0 ? [] : normalized.split("\n");
  const sections: RulebookSection[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.length === 0) {
      index += 1;
      continue;
    }

    if (isHeadingLine(line)) {
      sections.push({
        kind: "heading",
        start: index,
        end: index,
        title: headingTitle(line)
      });
      index += 1;
      continue;
    }

    if (isBulletLine(line)) {
      const start = index;
      while (index < lines.length && lines[index].length > 0 && isBulletLine(lines[index])) {
        index += 1;
      }
      sections.push({
        kind: "bullets",
        start,
        end: index - 1
      });
      continue;
    }

    const start = index;
    while (index < lines.length) {
      const current = lines[index];
      if (current.length === 0 || isHeadingLine(current) || isBulletLine(current)) {
        break;
      }
      index += 1;
    }
    sections.push({
      kind: "paragraphs",
      start,
      end: index - 1
    });
  }

  return { lines, sections };
}

function isHeadingLine(line: string): boolean {
  if (line.startsWith("#")) {
    return true;
  }
  if (line.endsWith(":")) {
    return true;
  }

  const lettersOnly = line.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 2) {
    return false;
  }
  return lettersOnly === lettersOnly.toUpperCase();
}

function headingTitle(line: string): string {
  let title = line.trim();
  if (title.startsWith("#")) {
    title = title.replace(/^#+\s*/, "");
  }
  if (title.endsWith(":")) {
    title = title.slice(0, -1).trim();
  }
  return title;
}

function isBulletLine(line: string): boolean {
  return /^(\-|\*|\d+\.)\s+/.test(line);
}
