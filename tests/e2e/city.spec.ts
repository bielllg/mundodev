import { test, expect } from "@playwright/test";
test("cidade, busca, perfil, notas e persistência", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Seu código. Sua história. Sua cidade.",
    }),
  ).toBeVisible();
  await expect(page.locator(".city-canvas canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `test-results/landing-${info.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Conhecer a demonstração completa" })
    .click();
  await page
    .getByRole("button", { name: "Buscar desenvolvedores", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar usuário GitHub" })
    .fill("mari");
  await page.getByRole("button", { name: /mari.codes.*Python/ }).click();
  await expect(page.getByRole("heading", { name: "mari.codes" })).toBeVisible();
  await page
    .getByRole("button", { name: "Prédio incrível! ❤️", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Seu recado");
  await page.getByRole("button", { name: "Fechar perfil" }).click();
  await page.getByRole("button", { name: "Notas", exact: true }).click();
  await page.getByRole("button", { name: "Nova nota", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Título da nota" })
    .fill("Uma cidade melhor");
  await page
    .getByRole("textbox", { name: "Conteúdo da nota" })
    .fill(
      "# Ideias\n- [ ] Plantar mais árvores\n<script>alert(1)</script>\n[malicioso](javascript:alert(1))",
    );
  await expect(page.getByText("Tudo salvo", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Visualizar Markdown" }).click();
  await expect(page.locator(".markdown")).toContainText("Plantar mais árvores");
  await expect(page.locator(".markdown script")).toHaveCount(0);
  await expect(page.locator('.markdown a[href^="javascript:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Fechar notas" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Notas", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Título da nota" }),
  ).toHaveValue("Uma cidade melhor");
  await page.getByRole("button", { name: "Fechar notas" }).click();
  await page.getByRole("button", { name: "Ampliar mapa" }).click();
  await page.getByRole("button", { name: "Reduzir mapa" }).click();
  await page.getByRole("button", { name: "Centralizar cidade" }).click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/city-${info.project.name}.png` });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("visitante não acessa notas nem publica recados", async ({ page }) => {
  await page.goto("/cidade?predio=demo-1");
  await expect(page.getByRole("heading", { name: "mari.codes" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prédio incrível! ❤️", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Notas", exact: true }),
  ).toHaveCount(0);
});
test("seleção no canvas, arraste, terrenos e modo leve", async ({ page }) => {
  await page.goto("/cidade");
  await expect(page.locator(".city-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Dispensar boas-vindas" }).click();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await page
    .getByRole("button", { name: /Porto Open Source.*Contribuições/ })
    .click();
  await page.waitForTimeout(800);
  await expect(page.locator(".location-badge")).toContainText(
    "Porto Open Source",
  );
  const viewport = page.viewportSize()!;
  await page.mouse.click(
    viewport.width / 2,
    viewport.height / 2 + (viewport.width < 700 ? 36 : 51),
  );
  await expect(
    page.getByRole("heading", { name: "Seu lugar na cidade." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Escolher este terreno" }).click();
  await expect(page.getByRole("status")).toContainText("Entre com GitHub");
  await page.getByRole("button", { name: "Fechar terreno" }).click();
  const before = await page.locator(".city-canvas canvas").screenshot();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 - 100, viewport.height / 2 + 60, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await page.locator(".city-canvas canvas").screenshot();
  expect(before.equals(after)).toBe(false);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Modo leve" }).check();
  await expect(page.getByRole("checkbox", { name: "Modo leve" })).toBeChecked();
});
