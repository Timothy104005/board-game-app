import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

interface LinkIssue {
  file: string;
  link: string;
  resolved: string;
}

function main(): void {
  const repoRoot = process.cwd();
  const docsDir = resolve(repoRoot, "docs");
  const mdFiles = readdirSync(docsDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => resolve(docsDir, entry));

  const issues: LinkIssue[] = [];
  let checkedCount = 0;

  for (const filePath of mdFiles) {
    const raw = readFileSync(filePath, "utf8");
    const linkTargets = extractMarkdownLinks(raw);
    for (const rawTarget of linkTargets) {
      const normalized = normalizeLinkTarget(rawTarget);
      if (!normalized || shouldIgnoreLink(normalized)) {
        continue;
      }
      const withoutAnchor = normalized.split("#")[0];
      if (!withoutAnchor) {
        continue;
      }
      const resolvedPath = resolve(dirname(filePath), withoutAnchor);
      checkedCount += 1;
      if (!existsSync(resolvedPath)) {
        issues.push({
          file: filePath.replace(/\\/g, "/"),
          link: rawTarget,
          resolved: resolvedPath.replace(/\\/g, "/")
        });
      }
    }
  }

  if (issues.length > 0) {
    console.error(`[docs:check] broken links detected: ${issues.length}`);
    for (const issue of issues) {
      console.error(`- ${issue.file}`);
      console.error(`  link: ${issue.link}`);
      console.error(`  resolved: ${issue.resolved}`);
    }
    process.exit(1);
  }

  console.log(`[docs:check] ok (${checkedCount} links checked across ${mdFiles.length} markdown files)`);
}

function extractMarkdownLinks(content: string): string[] {
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  const results: string[] = [];
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    results.push(match[1]);
    match = regex.exec(content);
  }
  return results;
}

function normalizeLinkTarget(target: string): string {
  const trimmed = target.trim().replace(/^<|>$/g, "");
  if (trimmed.length === 0) {
    return "";
  }
  const quotedTitleIndex = trimmed.search(/\s+"/);
  if (quotedTitleIndex > 0) {
    return trimmed.slice(0, quotedTitleIndex).trim();
  }
  const singleQuotedTitleIndex = trimmed.search(/\s+'/);
  if (singleQuotedTitleIndex > 0) {
    return trimmed.slice(0, singleQuotedTitleIndex).trim();
  }
  return trimmed;
}

function shouldIgnoreLink(link: string): boolean {
  return (
    link.startsWith("http://") ||
    link.startsWith("https://") ||
    link.startsWith("mailto:") ||
    link.startsWith("#")
  );
}

main();
