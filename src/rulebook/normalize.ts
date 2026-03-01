export function normalizeRulebookText(text: string): string {
  const normalizedNewlines = text.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim());
  return lines.join("\n").trim();
}
