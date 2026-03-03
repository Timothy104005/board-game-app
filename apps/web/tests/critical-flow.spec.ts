import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createPdfFixture } from "./helpers/pdfFixture";

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFilePath), "..", "..", "..");
const tictactoeRulebookPath = resolve(repoRoot, "src", "rulebook", "examples", "tictactoe.rulebook.txt");
const tictactoeRulebookText = readFileSync(tictactoeRulebookPath, "utf8");

test("critical flow: create project -> upload PDF -> run from PDF -> artifacts -> replay", async ({ page }) => {
  const { filePath, cleanup } = await createPdfFixture(tictactoeRulebookText.split(/\r?\n/));

  try {
    await page.goto("/projects/new");
    await page.getByLabel("Project Name").fill(`e2e-project-${Date.now()}`);
    await page.getByLabel("Default Seed").fill("42");
    await page.getByLabel("Rulebook Text").fill(tictactoeRulebookText);
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page).toHaveURL(/\/projects\/p\d{6}$/, { timeout: 60_000 });
    await page.getByLabel("PDF File").setInputFiles(filePath);
    await page.getByRole("button", { name: "Upload PDF" }).click();
    await expect(page).toHaveURL(/uploadId=u[a-f0-9]{12}$/, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Run from PDF" })).toBeVisible();

    await page.getByRole("button", { name: "Run from PDF" }).click();
    await expect(page).toHaveURL(/\/runs\/r\d{6}$/);
    await expect(page.getByTestId("run-status")).toHaveText("succeeded", { timeout: 120_000 });

    await page.getByRole("link", { name: /ir/i }).first().click();
    await expect(page.locator("pre")).toContainText("\"meta\"");
    await page.getByRole("link", { name: /back to run/i }).click();

    await page.getByRole("link", { name: /gaps/i }).first().click();
    await expect(page.locator("pre")).toContainText("\"gaps\"");
    await page.getByRole("link", { name: /back to run/i }).click();

    await page.getByRole("link", { name: /open replay/i }).first().click();
    await expect(page.getByTestId("replay-step-table")).toBeVisible();
  } finally {
    cleanup();
  }
});
