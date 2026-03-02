import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFilePath), "..", "..", "..");
const tictactoeRulebookPath = resolve(repoRoot, "src", "rulebook", "examples", "tictactoe.rulebook.txt");
const tictactoeRulebookText = readFileSync(tictactoeRulebookPath, "utf8");

test("critical flow: create project -> run -> gaps -> patch -> rerun -> replay", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(`e2e-project-${Date.now()}`);
  await page.getByLabel("Default Seed").fill("42");
  await page.getByLabel("Rulebook Text").fill(tictactoeRulebookText);
  await page.getByRole("button", { name: "Create Project" }).click();

  await expect(page).toHaveURL(/\/projects\/p\d{6}$/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Run Rulebook" }).click();

  await expect(page).toHaveURL(/\/runs\/r\d{6}$/);
  await expect(page.getByTestId("run-status")).toHaveText("succeeded", { timeout: 120_000 });

  await page.getByRole("link", { name: /ir/i }).first().click();
  await expect(page.locator("pre")).toContainText("\"meta\"");
  await page.getByRole("link", { name: /back to run/i }).click();

  await page.getByRole("link", { name: /gaps/i }).first().click();
  await expect(page.locator("pre")).toContainText("\"gaps\"");
  await page.getByRole("link", { name: /back to run/i }).click();
  await page.getByRole("link", { name: /back to project/i }).click();

  await page.locator("textarea[name='patchJson']").fill(
    JSON.stringify(
      {
        operations: [{ op: "set", path: "/meta/name", value: "patched_tictactoe" }]
      },
      null,
      2
    )
  );
  await page.getByRole("button", { name: "Apply Patch" }).click();

  await expect(page).toHaveURL(/\/runs\/r\d{6}$/);
  await expect(page.getByTestId("run-status")).toHaveText("succeeded", { timeout: 120_000 });
  await page.getByRole("link", { name: /back to project/i }).click();

  await page.getByRole("button", { name: "Run Sim" }).click();
  await expect(page).toHaveURL(/\/runs\/r\d{6}$/);
  await expect(page.getByTestId("run-status")).toHaveText("succeeded", { timeout: 120_000 });

  await page.getByRole("link", { name: /open replay/i }).first().click();
  await expect(page.getByTestId("replay-step-table")).toBeVisible();
});
