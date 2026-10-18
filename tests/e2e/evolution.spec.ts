import { test, expect } from "@playwright/test";
test("evolução conclui e respeita movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/e2e/fixtures/evolution.html");
  await expect(page.getByTestId("evolution-status")).toHaveText("Concluída");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.getByTestId("evolution-status")).toHaveText(
    "Em construção",
  );
  await expect(page.getByTestId("evolution-status")).toHaveText("Concluída", {
    timeout: 5000,
  });
});
