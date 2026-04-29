import { expect, test } from "@playwright/test";

test("demo mounts without console errors", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
	});

	await page.goto("/");
	await expect(page.locator("#root > *")).toHaveCount(1, { timeout: 15_000 });
	await page.waitForLoadState("networkidle");

	expect(errors, errors.join("\n")).toEqual([]);
});
