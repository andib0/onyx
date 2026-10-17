import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const user = JSON.parse(
  readFileSync(new URL("../fixtures/test-user.json", import.meta.url), "utf8")
);

test("login lands on Focus with the day score visible", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("Your password").fill(user.password);
  const t0 = Date.now();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible();
  const ms = Date.now() - t0;
  console.log(`sign-in → Focus visible: ${ms} ms`);
  await page.screenshot({ path: "results/focus.png" });
});
