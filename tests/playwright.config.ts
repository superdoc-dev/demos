import { defineConfig } from "@playwright/test";

const demos = [
	{ name: "esign", cwd: "../esign", port: 4173 },
	{ name: "template-builder", cwd: "../template-builder", port: 4174 },
];

export default defineConfig({
	testDir: ".",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	use: {
		trace: "retain-on-failure",
	},
	webServer: demos.map((d) => ({
		command: `bunx vite preview --port ${d.port} --strictPort`,
		cwd: d.cwd,
		url: `http://localhost:${d.port}`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	})),
	projects: demos.map((d) => ({
		name: d.name,
		use: { baseURL: `http://localhost:${d.port}` },
	})),
});
